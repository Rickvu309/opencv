import { type PaperDocument } from "@workspace/domain"
import { eq } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { transaction, withDatabase } from "../db/context.js"
import { paperDocs } from "../db/schema.js"
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

async function row(docId: string) {
  return (
    await store.db.select().from(paperDocs).where(eq(paperDocs.id, docId))
  )[0]!
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
