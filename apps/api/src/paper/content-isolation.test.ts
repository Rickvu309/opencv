import { parsePaperId, parseUserId } from "@workspace/domain"
import { loadYDoc, materialize, type PaperYDoc } from "@workspace/paper-crdt"
import { asc, eq } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"

import { getDb, transaction, withDatabase } from "../db/context.js"
import { paperDocUpdates, paperDocs } from "../db/schema.js"
import {
  bytesOf,
  clientFrom,
  encoded,
  openStore,
  twoParagraphCv,
  typed,
  withText,
} from "../test/paper-content.js"
import { syncContent, withContent } from "./content-store.js"

type Store = Awaited<ReturnType<typeof openStore>>
let store: Store
const owner = parseUserId("user-content-isolation")

beforeAll(async () => {
  store = await openStore(owner)
})

afterAll(async () => {
  await store.client.close()
})

async function created() {
  const result = await store.registry.execute({
    name: "paper.create",
    input: { kind: "cv", name: "Isolated CV", document: twoParagraphCv },
    actor: store.actor,
  })
  const docId = parsePaperId((result.output as { id: string }).id)
  const pull = await syncContent(owner, docId, {
    epoch: 0,
    update: new Uint8Array(),
    stateVector: new Uint8Array(),
  })
  return { docId, bytes: encoded(pull.update) }
}

async function snapshot(docId: string) {
  const [row] = await getDb()
    .select()
    .from(paperDocs)
    .where(eq(paperDocs.id, docId))
  if (!row) throw new Error("Missing Paper")
  const log = await getDb()
    .select()
    .from(paperDocUpdates)
    .where(eq(paperDocUpdates.paperId, docId))
    .orderBy(asc(paperDocUpdates.seq))
  return {
    document: row.crdtDocument,
    revision: row.contentVersion,
    epoch: row.crdtEpoch,
    base: row.crdtBase,
    baseSeq: row.crdtBaseSeq,
    log,
  }
}

function documentOf(yDoc: PaperYDoc) {
  const read = materialize(yDoc)
  if (!read.ok) throw new Error(read.reason)
  return read.document
}

async function expectPull(docId: ReturnType<typeof parsePaperId>) {
  const saved = await snapshot(docId)
  const pull = await syncContent(owner, docId, {
    epoch: 0,
    update: new Uint8Array(),
    stateVector: new Uint8Array(),
  })
  expect(pull.revision).toBe(saved.revision)
  expect(documentOf(loadYDoc(pull.update, []))).toEqual(saved.document)
  expect(await snapshot(docId)).toEqual(saved)
}

describe("Paper transaction candidate isolation", () => {
  it.each(["refusal", "throw"] as const)(
    "discards an append after a check %s before a later successful append",
    async (mode) => {
      await withDatabase(store.db, async () => {
        const { docId, bytes } = await created()
        const before = await snapshot(docId)
        const refused = bytesOf(
          typed(clientFrom(bytes), (paper) =>
            withText(paper, "t1", "Refused candidate")
          )
        )
        const accepted = bytesOf(
          typed(clientFrom(bytes), (paper) =>
            withText(paper, "t2", "Accepted candidate")
          )
        )
        await withContent(owner, docId, async (content) => {
          const attempt = content.append({
            origin: "coach",
            editId: `refused-${mode}`,
            update: refused,
            check: () => {
              if (mode === "throw") throw new Error("Check failed")
              return ["Check refused"]
            },
          })
          if (mode === "throw") {
            await expect(attempt).rejects.toThrow("Check failed")
          } else {
            expect(await attempt).toEqual({
              row: null,
              problems: ["Check refused"],
            })
          }
          expect(await snapshot(docId)).toEqual(before)
          const written = await content.append({
            origin: "coach",
            editId: `accepted-${mode}`,
            update: accepted,
          })
          expect(written.problems).toEqual([])
          expect(written.row?.contentVersion).toBe(before.revision + 1)
        })
        const after = await snapshot(docId)
        expect(after.document).toEqual(
          withText(twoParagraphCv, "t2", "Accepted candidate")
        )
        expect(after.revision).toBe(before.revision + 1)
        expect(after.log).toHaveLength(before.log.length + 1)
        expect(after.log.at(-1)?.editId).toBe(`accepted-${mode}`)
        expect(after.base).toEqual(before.base)
        await expectPull(docId)
      })
    }
  )

  it("drops pending dependency bytes from a failed attempt", async () => {
    await withDatabase(store.db, async () => {
      const { docId, bytes } = await created()
      const before = await snapshot(docId)
      const client = clientFrom(bytes)
      const first = bytesOf(
        typed(client, (paper) => withText(paper, "t1", "Accepted dependency"))
      )
      const missing = bytesOf(
        typed(client, (paper) =>
          withText(paper, "t1", "Refused dependent bytes")
        )
      )
      await withContent(owner, docId, async (content) => {
        await expect(
          content.append({
            origin: "coach",
            editId: "pending",
            update: missing,
          })
        ).rejects.toThrow("The update needs changes the server lacks")
        expect(await snapshot(docId)).toEqual(before)
        const accepted = await content.append({
          origin: "coach",
          editId: "dependency",
          update: first,
        })
        expect(accepted.row?.contentVersion).toBe(before.revision + 1)
      })
      const after = await snapshot(docId)
      expect(after.document).toEqual(
        withText(twoParagraphCv, "t1", "Accepted dependency")
      )
      expect(after.log).toHaveLength(before.log.length + 1)
      await expectPull(docId)
    })
  })

  it("keeps earlier successful edits after a later target throws", async () => {
    await withDatabase(store.db, async () => {
      const { docId } = await created()
      const before = await snapshot(docId)
      await withContent(owner, docId, async (content) => {
        const first = await content.edit({
          origin: "person",
          target: (paper) => withText(paper, "t1", "First success"),
        })
        const checkpoint = await snapshot(docId)
        await expect(
          content.edit({
            origin: "person",
            target: () => {
              throw new Error("Target failed")
            },
          })
        ).rejects.toThrow("Target failed")
        expect(await snapshot(docId)).toEqual(checkpoint)
        const second = await content.edit({
          origin: "person",
          target: (paper) => {
            expect(paper).toEqual(
              withText(twoParagraphCv, "t1", "First success")
            )
            return withText(paper, "t2", "Second success")
          },
        })
        expect(first.contentVersion).toBe(before.revision + 1)
        expect(second.contentVersion).toBe(before.revision + 2)
      })
      const after = await snapshot(docId)
      expect(after.document).toEqual(
        withText(
          withText(twoParagraphCv, "t1", "First success"),
          "t2",
          "Second success"
        )
      )
      expect(after.log.map((row) => row.seq)).toEqual([2, 3])
      await expectPull(docId)
    })
  })

  it("rolls back a callback that throws after a successful edit", async () => {
    await withDatabase(store.db, async () => {
      const { docId } = await created()
      const before = await snapshot(docId)
      await expect(
        withContent(owner, docId, async (content) => {
          await content.edit({
            origin: "person",
            target: (paper) => withText(paper, "t1", "Callback rolled back"),
          })
          throw new Error("Callback failed")
        })
      ).rejects.toThrow("Callback failed")
      expect(await snapshot(docId)).toEqual(before)
      await expectPull(docId)
    })
  })

  it.each(["edit", "sync"] as const)(
    "keeps a successful inner %s out of the shared head when the outer transaction rolls back",
    async (mode) => {
      await withDatabase(store.db, async () => {
        const { docId, bytes } = await created()
        const before = await snapshot(docId)
        const readCache = vi.spyOn(Map.prototype, "get")
        try {
          await expect(
            transaction(async () => {
              if (mode === "edit") {
                await withContent(owner, docId, async (content) => {
                  await content.edit({
                    origin: "person",
                    target: (paper) => withText(paper, "t1", "Rolled back"),
                  })
                })
              } else {
                const update = bytesOf(
                  typed(clientFrom(bytes), (paper) =>
                    withText(paper, "t1", "Rolled back")
                  )
                )
                await syncContent(owner, docId, {
                  epoch: 1,
                  basedOn: before.revision,
                  update,
                  stateVector: new Uint8Array(),
                })
              }
              expect((await snapshot(docId)).revision).toBe(before.revision + 1)
              const cached = readCache.mock.calls.flatMap(([key], index) => {
                if (key !== docId) return []
                const result: unknown = readCache.mock.results[index]?.value
                if (
                  !result ||
                  typeof result !== "object" ||
                  !("yDoc" in result)
                )
                  return []
                return [result.yDoc as PaperYDoc]
              })
              expect(cached).toHaveLength(1)
              expect(documentOf(cached[0]!)).toEqual(before.document)
              throw new Error("Outer receipt failed")
            })
          ).rejects.toThrow("Outer receipt failed")
        } finally {
          readCache.mockRestore()
        }
        expect(await snapshot(docId)).toEqual(before)
        await expectPull(docId)
      })
    }
  )
})
