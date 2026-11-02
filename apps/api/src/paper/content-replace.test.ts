import {
  ERROR_CODES,
  emptyCvDocument,
  type CvBlockDocument,
} from "@workspace/domain"
import { eq } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { withDatabase } from "../db/context.js"
import { paperDocUpdates, paperDocs } from "../db/schema.js"
import { createId } from "../id.js"
import {
  clientFrom,
  openStore,
  twoParagraphCv,
  typed,
  withText,
} from "../test/paper-content.js"

type Store = Awaited<ReturnType<typeof openStore>>
type View = { id: string; contentVersion: number; document: unknown }

let store: Store

beforeAll(async () => {
  store = await openStore("user-content-replace")
})

afterAll(async () => {
  await store.client.close()
})

async function run(name: string, input: unknown) {
  return store.registry.execute({ name, input, actor: store.actor })
}

async function created(kind: "cv" | "letter" = "cv", document?: unknown) {
  const result = await run("paper.create", { kind, name: "Doc", document })
  return result.output as View
}

async function reloaded(docId: string) {
  return (await store.registry.read(
    "paper.get",
    { docId },
    store.actor
  )) as View
}

function named(name: string): CvBlockDocument {
  return { ...twoParagraphCv, header: { ...twoParagraphCv.header, name } }
}

async function insertRaw(kind: "cv" | "letter", document: unknown) {
  const id = createId()
  await store.db.insert(paperDocs).values({
    id,
    userId: store.actor.userId,
    name: "Raw",
    kind,
    document: document as Record<string, unknown>,
    contentVersion: 4,
  })
  return id
}

async function pulled(docId: string) {
  const reply = await run("paper.sync", {
    docId,
    epoch: 0,
    update: "",
    stateVector: "",
  })
  return (reply.output as { update: string }).update
}

describe("paper.replace over the update log", () => {
  it("saves, reloads the same document and keeps the version check", async () => {
    await withDatabase(store.db, async () => {
      const doc = await created("cv", twoParagraphCv)
      const sent = named("Saved name")
      const saved = await run("paper.replace", {
        docId: doc.id,
        contentVersion: doc.contentVersion,
        document: sent,
      })
      expect((await reloaded(doc.id)).document).toEqual(sent)
      expect((await reloaded(doc.id)).contentVersion).toBe(2)
      const rows = await store.db
        .select()
        .from(paperDocUpdates)
        .where(eq(paperDocUpdates.paperId, doc.id))
      expect(rows.map((row) => [row.seq, row.origin])).toEqual([[2, "person"]])

      await expect(
        run("paper.replace", {
          docId: doc.id,
          contentVersion: doc.contentVersion,
          document: named("Stale name"),
        })
      ).rejects.toMatchObject({ code: ERROR_CODES.CONFLICT })

      await run(saved.reversal!.command, saved.reversal!.input)
      expect((await reloaded(doc.id)).document).toEqual(twoParagraphCv)
    })
  })

  it("lets a push see a replace and a replace follow a push", async () => {
    await withDatabase(store.db, async () => {
      const doc = await created("cv", twoParagraphCv)
      await run("paper.replace", {
        docId: doc.id,
        contentVersion: 1,
        document: named("Replaced"),
      })
      const client = clientFrom(await pulled(doc.id))
      const push = typed(client, (paper) =>
        withText(paper, "t1", "Typed after the replace")
      )
      const reply = await run("paper.sync", {
        docId: doc.id,
        epoch: 1,
        update: push,
        stateVector: "",
      })
      expect(reply.output).toMatchObject({ revision: 3 })
      const seen = (await reloaded(doc.id)).document
      expect(JSON.stringify(seen)).toContain("Replaced")
      expect(JSON.stringify(seen)).toContain("Typed after the replace")

      await expect(
        run("paper.replace", {
          docId: doc.id,
          contentVersion: 2,
          document: named("Behind"),
        })
      ).rejects.toMatchObject({ code: ERROR_CODES.CONFLICT })
      await run("paper.replace", {
        docId: doc.id,
        contentVersion: 3,
        document: named("After the push"),
      })
      expect((await reloaded(doc.id)).contentVersion).toBe(4)
    })
  })

  it("turns a version 1 CV into version 2 on its first write", async () => {
    await withDatabase(store.db, async () => {
      const v1 = {
        ...emptyCvDocument(),
        name: "Lan Nguyen",
        summary: "Ships small experiments.",
        skills: [{ label: "Tools", items: ["Figma", "SQL, Postgres"] }],
      }
      const id = await insertRaw("cv", v1)
      const saved = await run("paper.replace", {
        docId: id,
        contentVersion: 4,
        document: { ...v1, name: "Lan N." },
      })
      const document = (saved.output as View).document as CvBlockDocument
      expect(document.version).toBe(2)
      expect(document.header.name).toBe("Lan N.")
      const words = JSON.stringify(document)
      for (const word of ["Ships small experiments.", "SQL, Postgres"]) {
        expect(words).toContain(word)
      }
      await run(saved.reversal!.command, saved.reversal!.input)
      expect(JSON.stringify((await reloaded(id)).document)).toContain(
        "Lan Nguyen"
      )
    })
  })
})
