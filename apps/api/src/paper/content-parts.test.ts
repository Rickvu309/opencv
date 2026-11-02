import { parseUserId } from "@workspace/domain"
import { eq } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { withDatabase } from "../db/context.js"
import { paperDocs } from "../db/schema.js"
import {
  clientFrom,
  openStore,
  twoParagraphCv,
  typed,
  withText,
} from "../test/paper-content.js"
import { saveFile } from "./index.js"

type Store = Awaited<ReturnType<typeof openStore>>
type View = { id: string; contentVersion: number; document: unknown }

let store: Store

beforeAll(async () => {
  store = await openStore("user-content-parts")
})

afterAll(async () => {
  await store.client.close()
})

async function run(name: string, input: unknown) {
  return store.registry.execute({ name, input, actor: store.actor })
}

async function pushed(docId: string, change: Parameters<typeof typed>[1]) {
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
    update: typed(client, change),
    stateVector: "",
  })
}

async function documentOf(docId: string) {
  return (
    await store.db.select().from(paperDocs).where(eq(paperDocs.id, docId))
  )[0]!.document
}

describe("letter parts", () => {
  it("keeps the parts when the body is edited through a push", async () => {
    await withDatabase(store.db, async () => {
      const stored = {
        markdown: "Body paragraph.",
        sender: "Linh",
        date: "2 Nov 2026",
        closing: "Warm regards,",
        signature: "Linh",
      }
      const created = await run("paper.create", {
        kind: "letter",
        name: "Letter",
        document: stored,
      })
      const docId = (created.output as View).id
      await pushed(docId, (paper) =>
        withText(paper, "l-3", "Body paragraph, edited.")
      )
      expect(await documentOf(docId)).toEqual({
        ...stored,
        markdown: "Body paragraph, edited.",
      })
    })
  })
})

describe("attachPhoto undo", () => {
  it("restores the text that was synced before the photo", async () => {
    await withDatabase(store.db, async () => {
      const created = await run("paper.create", {
        kind: "cv",
        name: "CV",
        document: twoParagraphCv,
      })
      const docId = (created.output as View).id
      await pushed(docId, (paper) => withText(paper, "t1", "Typed first."))
      const photo = await saveFile({
        userId: parseUserId(store.actor.userId),
        name: "face.png",
        mediaType: "image/png",
        bytes: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        purpose: "avatar",
      })
      const attached = await run("paper.attachPhoto", {
        docId,
        fileId: photo.id,
      })
      expect(JSON.stringify(await documentOf(docId))).toContain(
        '"photo":"file:'
      )
      const plan = attached.reversal!
      await run(plan.command, plan.input)
      const text = JSON.stringify(await documentOf(docId))
      expect(text).toContain("Typed first.")
      expect(text).not.toContain('"photo":"file:')
    })
  })
})
