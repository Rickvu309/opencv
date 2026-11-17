import {
  NATIVE_WRITER,
  RICH_NATIVE_WRITER,
  nativePaperDocumentSchema,
  paperViewSchema,
  personActor,
} from "@workspace/domain"
import { seedYDoc } from "@workspace/paper-crdt"
import { eq } from "drizzle-orm"
import { expect, it } from "vitest"
import { z } from "zod"
import { getDb } from "../db/context.js"
import { coachTasks, paperDocs } from "../db/schema.js"
import { seedCoachActor } from "../test/coach-turn.js"
import {
  richTaskFixture as fixture,
  savedRichPaper,
} from "../test/rich-coach.test-support.js"

it.each([
  NATIVE_WRITER,
  {
    ...NATIVE_WRITER,
    supportedSchemaRevisions: [1, 2],
    capabilities: [
      ...new Set([
        ...NATIVE_WRITER.capabilities,
        ...RICH_NATIVE_WRITER.capabilities,
      ]),
    ],
  },
])(
  "Undo restores schema-1 Unicode prose with writer $supportedSchemaRevisions",
  (writer) =>
    fixture(async ({ ownerId, taskId, db }, registry) => {
      const actor = personActor(ownerId)
      const task = z
        .object({ chatId: z.string() })
        .parse(
          (
            await getDb()
              .select()
              .from(coachTasks)
              .where(eq(coachTasks.id, taskId))
          )[0]
        )
      const coach = await seedCoachActor(ownerId, task.chatId)
      const saved = await savedRichPaper(db, ownerId, "letter")
      const native = nativePaperDocumentSchema.parse({
        version: 4,
        schemaRevision: 1,
        kind: "letter",
        clashes: [],
        blocks: [
          {
            id: "p1",
            type: "paragraph",
            content: [{ text: "Việt 😀", underline: true }],
          },
        ],
      })
      await getDb()
        .update(paperDocs)
        .set({
          crdtBase: Buffer.from(seedYDoc(native)),
          crdtDocument: native,
        })
        .where(eq(paperDocs.id, saved.id))
      const initial = paperViewSchema.parse(
        await registry.read("paper.get", { docId: saved.id, writer }, actor)
      )
      const outline = z
        .object({ revision: z.number(), nativeBasis: z.unknown() })
        .parse(
          await registry.read(
            "paper.outline",
            { docId: saved.id, writer },
            actor
          )
        )
      const pending = await registry.execute({
        name: "paper.edit",
        input: {
          docId: saved.id,
          writer,
          basedOn: outline.revision,
          nativeBasis: outline.nativeBasis,
          edits: [{ op: "setText", blockId: "p1", text: "Changed Việt 😀" }],
        },
        actor: coach,
      })
      expect(pending.pending).toBe(true)
      expect(
        paperViewSchema.parse(
          await registry.read("paper.get", { docId: saved.id, writer }, actor)
        )
      ).toEqual(initial)
      const receipt = await registry.approve(
        ownerId,
        z.string().parse(pending.pendingActionId)
      )
      if (!receipt) throw new Error("Missing native approval receipt")
      const approved = paperViewSchema.parse(
        await registry.read("paper.get", { docId: saved.id, writer }, actor)
      )
      expect(approved.paper.blocks[0]).toMatchObject({
        content: [{ text: "Changed " }, { text: "Việt 😀", underline: true }],
      })
      await registry.undo(ownerId, receipt.id)
      const undone = paperViewSchema.parse(
        await registry.read("paper.get", { docId: saved.id, writer }, actor)
      )
      expect(undone.paper).toEqual(native)
      expect(undone.contentVersion).toBe(approved.contentVersion + 1)
    })
)
