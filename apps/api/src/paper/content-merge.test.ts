import {
  emptyCvDocument,
  type CvBlockDocument,
  type PaperDocument,
} from "@workspace/domain"
import { eq } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { transaction, withDatabase } from "../db/context.js"
import { paperDocUpdates, paperDocs } from "../db/schema.js"
import { createId } from "../id.js"
import {
  clientFrom,
  openStore,
  twoParagraphCv,
  typed,
} from "../test/paper-content.js"
import { withContent } from "./content-store.js"

type Store = Awaited<ReturnType<typeof openStore>>
type View = { id: string; contentVersion: number; document: unknown }

let store: Store

beforeAll(async () => {
  store = await openStore("user-content-merge")
})

afterAll(async () => {
  await store.client.close()
})

async function run(name: string, input: unknown) {
  return store.registry.execute({ name, input, actor: store.actor })
}

async function created(document: unknown = twoParagraphCv) {
  const result = await run("paper.create", {
    kind: "cv",
    name: "Doc",
    document,
  })
  return result.output as View
}

async function reloaded(docId: string) {
  return (await store.registry.read(
    "paper.get",
    { docId },
    store.actor
  )) as View
}

async function row(docId: string) {
  return (
    await store.db.select().from(paperDocs).where(eq(paperDocs.id, docId))
  )[0]!
}

async function logged(docId: string) {
  return (
    await store.db
      .select()
      .from(paperDocUpdates)
      .where(eq(paperDocUpdates.paperId, docId))
  ).length
}

function richer(paper: PaperDocument): PaperDocument {
  return {
    ...paper,
    blocks: paper.blocks.map((block) => {
      if (block.id === "t1" && "content" in block) {
        return { ...block, content: [{ text: "First paragraph.", bold: true }] }
      }
      return block.type === "section"
        ? { ...block, title: "Selected work" }
        : block
    }),
  } as PaperDocument
}

async function pushRicher(docId: string) {
  const pulled = await run("paper.sync", {
    docId,
    epoch: 0,
    update: "",
    stateVector: "",
  })
  const client = clientFrom((pulled.output as { update: string }).update)
  await run("paper.sync", {
    docId,
    epoch: 1,
    update: typed(client, richer),
    stateVector: "",
  })
}

describe("replace over version 3 content", () => {
  it("keeps marks and section titles when the old editor changes the header", async () => {
    await withDatabase(store.db, async () => {
      const doc = await created()
      await pushRicher(doc.id)
      const seen = await reloaded(doc.id)
      const old = seen.document as CvBlockDocument
      await run("paper.replace", {
        docId: doc.id,
        contentVersion: seen.contentVersion,
        document: { ...old, header: { ...old.header, name: "Ada L." } },
      })
      const text = JSON.stringify((await row(doc.id)).crdtDocument)
      expect(text).toContain('"bold":true')
      expect(text).toContain("Selected work")
      expect(text).toContain("Ada L.")
    })
  })

  it("writes nothing when the old editor saves the projection unchanged", async () => {
    await withDatabase(store.db, async () => {
      const doc = await created()
      await pushRicher(doc.id)
      const before = await row(doc.id)
      const seen = await reloaded(doc.id)
      const saved = await run("paper.replace", {
        docId: doc.id,
        contentVersion: seen.contentVersion,
        document: seen.document,
      })
      const after = await row(doc.id)
      expect(after.crdtDocument).toEqual(before.crdtDocument)
      expect(after.contentVersion).toBe(before.contentVersion)
      expect((saved.output as View).contentVersion).toBe(before.contentVersion)
      expect(await logged(doc.id)).toBe(1)
    })
  })

  it("lets a version 1 CV save itself unchanged and then change", async () => {
    await withDatabase(store.db, async () => {
      const v1 = { ...emptyCvDocument(), name: "Lan", summary: "Hello there." }
      const id = createId()
      await store.db.insert(paperDocs).values({
        id,
        userId: store.actor.userId,
        name: "Old",
        kind: "cv",
        document: v1,
        contentVersion: 3,
      })
      await run("paper.replace", { docId: id, contentVersion: 3, document: v1 })
      expect((await row(id)).document).toEqual(v1)
      expect(await logged(id)).toBe(0)
      await run("paper.replace", {
        docId: id,
        contentVersion: 3,
        document: { ...v1, name: "Lan N." },
      })
      expect((await row(id)).contentVersion).toBe(4)
    })
  })
})

describe("duplicate and nested locks", () => {
  it("copies marks and titles into a duplicate", async () => {
    await withDatabase(store.db, async () => {
      const doc = await created()
      await pushRicher(doc.id)
      const copy = (await run("paper.duplicate", { docId: doc.id }))
        .output as View
      const text = JSON.stringify((await row(copy.id)).crdtDocument)
      expect(text).toContain('"bold":true')
      expect(text).toContain("Selected work")
    })
  })

  it("lets one transaction lock the same paper twice", async () => {
    await withDatabase(store.db, async () => {
      const doc = await created()
      const revision = await transaction(async () => {
        await withContent(
          store.actor.userId,
          doc.id as never,
          async (a) => a.row
        )
        return withContent(store.actor.userId, doc.id as never, async (b) => {
          const edited = await b.edit({
            origin: "server",
            target: richer(b.document),
          })
          return edited.contentVersion
        })
      })
      expect(revision).toBe(2)
    })
  })
})
