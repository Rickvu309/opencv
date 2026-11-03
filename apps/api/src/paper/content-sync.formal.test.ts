import {
  parsePaperId,
  parseUserId,
  type PaperDocument,
} from "@workspace/domain"
import {
  absorbUpdate,
  loadYDoc,
  materialize,
  stateVectorOf,
} from "@workspace/paper-crdt"
import { asc, eq } from "drizzle-orm"
import fc from "fast-check"
import { describe, expect, it } from "vitest"

import { getDb, withDatabase } from "../db/context.js"
import { paperDocUpdates, paperDocs } from "../db/schema.js"
import {
  REAL,
  SEED,
  backend,
  newPerson,
  registerBackendHooks,
  registry,
} from "../test/registry-formal-support.js"
import {
  bytesOf,
  clientFrom,
  encoded,
  twoParagraphCv,
  typed,
  withText,
} from "../test/paper-content.js"
import {
  cacheRevisionUsable,
  coachBasisOk,
  nextContentSeq,
  sameContentVersion,
  withContent,
} from "./content-store.js"

registerBackendHooks()

const MARK = "✦"
const RUNS = Number(process.env.PAPER_SYNC_CASES ?? (REAL ? 8 : 20))

type Actor = Awaited<ReturnType<typeof newPerson>>["person"]
type Client = ReturnType<typeof clientFrom>
type Page = {
  docId: string
  client: Client
  legacy: unknown
  revision: number
}
type EditReply = {
  editId: string | null
  revision: number
  outcomes: { status: string }[]
}
type SyncReply = {
  revision: number
  stale: boolean
  update: string
}

function blockText(document: PaperDocument, id: string) {
  const block = document.blocks.find((item) => item.id === id)
  if (!block || !("content" in block)) return ""
  return block.content.map((part) => part.text).join("")
}

function texts(document: unknown) {
  const blocks = (document as { blocks?: { content?: { text?: string }[] }[] })
    .blocks
  if (!blocks) return ""
  return blocks
    .map((block) =>
      (block.content ?? []).map((part) => part.text ?? "").join("")
    )
    .join("\n")
}

function readClient(client: Client) {
  const read = materialize(client)
  if (!read.ok) throw new Error(read.reason)
  return read.document
}

async function run(actor: Actor, name: string, input: unknown) {
  return registry.execute({ name, input, actor })
}

async function created(actor: Actor): Promise<Page> {
  const result = await run(actor, "paper.create", {
    kind: "cv",
    name: "Sync CV",
    document: twoParagraphCv,
  })
  const docId = (result.output as { id: string }).id
  const pulled = await run(actor, "paper.sync", {
    docId,
    epoch: 0,
    update: "",
    stateVector: "",
  })
  const client = clientFrom((pulled.output as { update: string }).update)
  const legacy = (
    await getDb().select().from(paperDocs).where(eq(paperDocs.id, docId))
  )[0]!.document
  return { docId, client, legacy, revision: 1 }
}

async function sync(
  actor: Actor,
  page: Page,
  update: string,
  basedOn?: number
) {
  const input: {
    docId: string
    epoch: number
    update: string
    stateVector: string
    basedOn?: number
  } = {
    docId: page.docId,
    epoch: 1,
    update,
    stateVector: encoded(stateVectorOf(page.client)),
  }
  if (update.length > 0 || basedOn !== undefined) {
    input.basedOn = basedOn ?? page.revision
  }
  const result = await run(actor, "paper.sync", input)
  const reply = result.output as SyncReply
  if (reply.update) absorbUpdate(page.client, bytesOf(reply.update), "log")
  page.revision = reply.revision
  return reply
}

async function expectProtocol(docId: string) {
  const [doc] = await getDb()
    .select()
    .from(paperDocs)
    .where(eq(paperDocs.id, docId))
  const rows = await getDb()
    .select()
    .from(paperDocUpdates)
    .where(eq(paperDocUpdates.paperId, docId))
    .orderBy(asc(paperDocUpdates.seq))
  expect(doc?.crdtBase).toBeTruthy()
  const base = doc!.crdtBaseSeq ?? doc!.contentVersion
  const seqs = rows.map((row) => row.seq)
  expect(doc!.contentVersion).toBe(seqs.at(-1) ?? base)
  seqs.forEach((seq, index) => {
    expect(seq).toBe(base + index + 1)
  })
  const materialized = materialize(
    loadYDoc(
      new Uint8Array(doc!.crdtBase!),
      rows.map((row) => new Uint8Array(row.update))
    )
  )
  expect(materialized.ok).toBe(true)
  if (!materialized.ok) return ""
  expect(materialized.document).toEqual(doc!.crdtDocument)
  return texts(doc!.crdtDocument)
}

async function typeMark(actor: Actor, page: Page, mark: string) {
  const pulled = await sync(actor, page, "")
  expect(pulled.stale).toBe(false)
  const push = typed(page.client, (paper) =>
    withText(paper, "t1", `${blockText(paper, "t1")}${mark}`)
  )
  const written = await sync(actor, page, push)
  expect(written.stale).toBe(false)
  return written
}

describe("paper sync formulas", () => {
  it("rejects an ahead cache, numbers from the cached revision, and keeps a stale replace out", () => {
    expect(cacheRevisionUsable(6, 5)).toBe(false)
    expect(cacheRevisionUsable(5, 5)).toBe(true)
    expect(cacheRevisionUsable(4, 5)).toBe(true)
    expect(nextContentSeq(4)).toBe(5)
    expect(sameContentVersion(3, 3)).toBe(true)
    expect(sameContentVersion(3, 2)).toBe(false)
    expect(coachBasisOk(1, 4, 1)).toBe(true)
    expect(coachBasisOk(5, 4, 1)).toBe(false)
    expect(coachBasisOk(0, 4, 1)).toBe(false)
    const snapshot = 1
    const taken = new Set([nextContentSeq(snapshot)])
    expect(taken.has(snapshot + 1)).toBe(true)
    expect(taken.has(nextContentSeq(snapshot + 1))).toBe(false)
  })
})

describe("paper sync store", () => {
  it("drops a cache left ahead by a rolled-back commit", async () => {
    await withDatabase(backend.db, async () => {
      const { person } = await newPerson()
      const page = await created(person)
      const before = texts(readClient(page.client))
      await expect(
        withContent(
          parseUserId(person.userId),
          parsePaperId(page.docId),
          async (content) => {
            await content.edit({
              origin: "person",
              target: withText(
                content.document,
                "t1",
                "First paragraph. ROLLED"
              ),
              witness: content.row.document,
            })
            throw new Error("rollback")
          }
        )
      ).rejects.toThrow("rollback")
      expect(await expectProtocol(page.docId)).toBe(before)
      const reply = await sync(person, page, "", 1)
      expect(reply.stale).toBe(false)
      expect(reply.revision).toBe(1)
      expect(texts(readClient(page.client))).toBe(before)
    })
  }, 30_000)

  it("gives two edits in one lock consecutive change numbers", async () => {
    await withDatabase(backend.db, async () => {
      const { person } = await newPerson()
      const page = await created(person)
      await withContent(
        parseUserId(person.userId),
        parsePaperId(page.docId),
        async (content) => {
          await content.edit({
            origin: "person",
            target: withText(
              readClient(page.client),
              "t1",
              "First paragraph. One"
            ),
            witness: content.row.document,
          })
          await content.edit({
            origin: "person",
            target: (current: PaperDocument) =>
              withText(current, "t2", "Second paragraph. Two"),
            witness: content.row.document,
          })
        }
      )
      const stored = await expectProtocol(page.docId)
      expect(stored).toContain("One")
      expect(stored).toContain("Two")
    })
  }, 30_000)

  it("keeps a typed character when Coach edits another block from an older read", async () => {
    await withDatabase(backend.db, async () => {
      const { person } = await newPerson()
      const page = await created(person)
      await typeMark(person, page, MARK)
      const edited = await run(person, "paper.edit", {
        docId: page.docId,
        basedOn: 1,
        edits: [
          { op: "setText", blockId: "t2", text: "Second paragraph. Noted." },
        ],
      })
      const output = edited.output as EditReply
      expect(output.editId).toBeTruthy()
      expect(output.outcomes[0]?.status).toBe("applied")
      await expect(
        run(person, "paper.replace", {
          docId: page.docId,
          contentVersion: 1,
          document: page.legacy,
        })
      ).rejects.toMatchObject({ code: "CONFLICT" })
      const stored = await expectProtocol(page.docId)
      expect(stored).toContain(MARK)
      expect(stored).toContain("Noted")
    })
  }, 30_000)

  it("a replace at the live version with the old page wipes the typed character", async () => {
    await withDatabase(backend.db, async () => {
      const { person } = await newPerson()
      const page = await created(person)
      await typeMark(person, page, MARK)
      await run(person, "paper.replace", {
        docId: page.docId,
        contentVersion: page.revision,
        document: page.legacy,
      })
      expect(await expectProtocol(page.docId)).not.toContain(MARK)
    })
  }, 30_000)

  it("keeps every typed character across coach edits and stale replaces", async () => {
    await withDatabase(backend.db, async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.constantFrom(
              "coachOther",
              "coachSame",
              "staleReplace",
              "typeMore"
            ),
            { minLength: 1, maxLength: 3 }
          ),
          async (steps) => {
            const { person } = await newPerson()
            const page = await created(person)
            const marks = [MARK]
            await typeMark(person, page, MARK)
            let other = 0
            let otherLanded = false
            for (const step of steps) {
              if (step === "typeMore") {
                const mark = `${MARK}${marks.length}`
                marks.push(mark)
                await typeMark(person, page, mark)
              } else if (step === "coachOther") {
                other += 1
                const edited = await run(person, "paper.edit", {
                  docId: page.docId,
                  basedOn: 1,
                  edits: [
                    {
                      op: "setText",
                      blockId: "t2",
                      text: `Second paragraph. Note ${other}.`,
                    },
                  ],
                })
                const reply = edited.output as EditReply
                if (!otherLanded) {
                  expect(reply.editId).toBeTruthy()
                  expect(reply.outcomes[0]?.status).toBe("applied")
                  otherLanded = true
                }
              } else if (step === "coachSame") {
                await run(person, "paper.edit", {
                  docId: page.docId,
                  basedOn: 1,
                  edits: [
                    {
                      op: "setText",
                      blockId: "t1",
                      text: "First paragraph. Reviewed.",
                    },
                  ],
                })
              } else {
                await expect(
                  run(person, "paper.replace", {
                    docId: page.docId,
                    contentVersion: 1,
                    document: page.legacy,
                  })
                ).rejects.toMatchObject({ code: "CONFLICT" })
              }
              const stored = await expectProtocol(page.docId)
              for (const mark of marks) expect(stored).toContain(mark)
            }
          }
        ),
        { numRuns: RUNS, seed: SEED }
      )
    })
  }, 120_000)
})
