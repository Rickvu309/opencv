import { parseUserId, personActor } from "@workspace/domain/kernel"
import {
  RICH_NATIVE_WRITER,
  paperPhotoRef,
  richPaperDocumentSchema,
} from "@workspace/domain/paper-doc"
import { eq } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { withDatabase } from "../db/context.js"
import { paperDocs, user } from "../db/schema.js"
import { installRegistry } from "../install.js"
import { seedCoachActor } from "../test/coach-turn.js"
import { createMigratedTestDb } from "../test/harness.js"
import { richPaper } from "../test/rich-paper.js"
import { seedColumns } from "./content-document.js"
import { saveFile } from "./index.js"
import { png } from "./photo.fixtures.js"

type Outline = {
  revision: number
  nativeBasis: unknown
  outline: string
}
type Node = { id: string; content: { text: string }[] }

let db: Awaited<ReturnType<typeof createMigratedTestDb>>["db"]
let close: () => Promise<void>
const registry = installRegistry()
const userId = "user-rich-edit"
const person = personActor(userId)

beforeAll(async () => {
  const opened = await createMigratedTestDb()
  db = opened.db
  close = () => opened.client.close()
  await db.insert(user).values({
    id: userId,
    name: "Ada",
    email: "ada-rich-edit@example.com",
  })
})

afterAll(async () => {
  await close()
})

async function richCv() {
  const created = await registry.execute({
    name: "paper.create",
    input: { kind: "cv", name: "Rich CV" },
    actor: person,
  })
  const docId = (created.output as { id: string }).id
  const photo = await saveFile({
    userId: parseUserId(userId),
    name: "portrait.png",
    mediaType: "image/png",
    bytes: Buffer.from(png),
    purpose: "avatar",
  })
  await db
    .update(paperDocs)
    .set(
      seedColumns(
        "cv",
        richPaperDocumentSchema.parse(richPaper("cv", paperPhotoRef(photo.id)))
      )
    )
    .where(eq(paperDocs.id, docId))
  return docId
}

async function outline(docId: string) {
  const read = (await registry.read(
    "paper.outline",
    { docId },
    person
  )) as Outline
  const nodes = JSON.parse(read.outline) as Node[]
  const text = (id: string) =>
    (nodes.find((node) => node.id === id)?.content ?? [])
      .map((run) => run.text)
      .join("")
  return { read, text }
}

async function coach() {
  const chat = await registry.execute({
    name: "chat.create",
    input: {},
    actor: person,
  })
  return seedCoachActor(userId, (chat.output as { id: string }).id)
}

function proposal(docId: string, read: Outline, before: string, text: string) {
  return {
    docId,
    basedOn: read.revision,
    writer: RICH_NATIVE_WRITER,
    nativeBasis: read.nativeBasis,
    edits: [
      {
        op: "replaceText",
        blockId: "intro",
        from: 0,
        to: before.length,
        before,
        text,
      },
    ],
  }
}

describe("the Coach edits a rich CV", () => {
  it("writes nothing until the person approves, then refuses a stale proposal, and Undo puts the words back", async () => {
    await withDatabase(db, async () => {
      const docId = await richCv()
      const first = await outline(docId)
      const original = first.text("intro")
      const word = original.slice(0, 4)
      const actor = await coach()

      const pending = await registry.execute({
        name: "paper.edit",
        input: proposal(docId, first.read, word, "Lan"),
        actor,
      })
      expect(pending.pending).toBe(true)
      expect((await outline(docId)).text("intro")).toBe(original)

      const approved = await registry.approve(userId, pending.pendingActionId!)
      expect(approved?.command).toBe("paper.edit")
      const edited = await outline(docId)
      expect(edited.text("intro")).toBe(`Lan${original.slice(4)}`)
      expect(edited.read.revision).toBeGreaterThan(first.read.revision)

      const stale = await registry.execute({
        name: "paper.edit",
        input: proposal(docId, first.read, word, "Mai"),
        actor,
      })
      await expect(
        registry.approve(userId, stale.pendingActionId!)
      ).rejects.toMatchObject({ code: "CONFLICT" })
      expect((await outline(docId)).text("intro")).toBe(
        `Lan${original.slice(4)}`
      )

      await registry.undo(userId, approved!.id)
      expect((await outline(docId)).text("intro")).toBe(original)
    })
  })
})
