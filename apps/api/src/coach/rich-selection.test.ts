import {
  RICH_NATIVE_WRITER,
  personActor,
  richReadOutputSchema,
  richReviewSchema,
  richTextNodes,
} from "@workspace/domain"
import { eq } from "drizzle-orm"
import { expect, it } from "vitest"
import { z } from "zod"
import { getDb } from "../db/context.js"
import { coachTasks, paperDocs, pendingActions } from "../db/schema.js"
import { savedRichWord } from "../paper/native-word.test-support.js"
import { resolveTurnGrounding } from "./context.js"
import { fakePaperIntent } from "./fake.js"
import { createTaskRuntime } from "./task-runtime.js"
import { runCoachWorker } from "./worker.js"
import { settings } from "./worker-fixture.test-support.js"
import { richTaskFixture as fixture } from "./rich-task.test-support.js"

it.each([
  { kind: "cv" as const, introLength: 40 },
  { kind: "cv" as const, introLength: 25_000 },
  { kind: "letter" as const, introLength: 40 },
  { kind: "letter" as const, introLength: 25_000 },
])(
  "saved fake $kind worker proposes only the selected passage after $introLength characters",
  ({ kind, introLength }) =>
    fixture(async ({ ownerId, taskId, db }, registry) => {
      const actor = personActor(ownerId)
      const saved = await savedRichWord(db, ownerId, kind, (doc) => {
        const intro = richTextNodes(doc).find((node) => node.id === "intro")
        if (!intro) throw new Error("Missing introduction")
        intro.content = [{ text: "ế".repeat(introLength) }]
      })
      const context = [
        { kind: "paper" as const, id: saved.id, blockIds: ["after"] },
      ]
      const grounding = await resolveTurnGrounding({
        registry,
        actor,
        requestFocusDocId: saved.id,
        storedKind: null,
        storedId: null,
        context,
        memoryEnabled: false,
      })
      const focus = grounding.focusDoc
      if (!focus) throw new Error("Missing rich focus")
      const rows = z
        .array(z.object({ id: z.string(), selected: z.boolean() }))
        .parse(JSON.parse(focus.outline))
      expect(
        rows.filter((node) => node.selected).map((node) => node.id)
      ).toEqual(["after"])
      expect(grounding.note).toContain('\\"id\\":\\"after\\"')
      expect(grounding.note).toContain('\\"selected\\":true')
      expect(fakePaperIntent(focus)).toMatchObject({
        input: { edits: [{ blockId: "after" }] },
      })
      await getDb()
        .update(coachTasks)
        .set({
          contextSnapshot: {
            messages: [],
            focusDoc: focus,
            context,
            note: grounding.note,
          },
        })
        .where(eq(coachTasks.id, taskId))
      await runCoachWorker({
        ...settings,
        registry,
        runtime: (task) => createTaskRuntime(task, registry),
      })
      expect((await getDb().select().from(coachTasks))[0]?.state).toBe(
        "waitingApproval"
      )
      const [pending] = await getDb().select().from(pendingActions)
      if (!pending) throw new Error("Missing selected proposal")
      expect(pending.input).toMatchObject({
        docId: saved.id,
        edits: [{ blockId: "after" }],
      })
      const review = richReviewSchema.parse(
        z.object({ review: z.unknown() }).parse(pending.frozenReview).review
      )
      expect(review.changes.map((change) => change.blockId)).toEqual(["after"])
      expect(
        (
          await getDb()
            .select()
            .from(paperDocs)
            .where(eq(paperDocs.id, saved.id))
        )[0]?.crdtDocument
      ).toEqual(saved.document)
      const receipt = await registry.approve(ownerId, pending.id)
      if (!receipt) throw new Error("Missing selected approval receipt")
      const expected = structuredClone(saved.document)
      const after = richTextNodes(expected).find((node) => node.id === "after")
      if (!after) throw new Error("Missing selected passage")
      after.content = after.content.map((run) => ({
        ...run,
        bold: true,
        underline: true,
      }))
      expect(
        (
          await getDb()
            .select()
            .from(paperDocs)
            .where(eq(paperDocs.id, saved.id))
        )[0]?.crdtDocument
      ).toEqual(expected)
      await registry.undo(ownerId, receipt.id)
      expect(
        (
          await getDb()
            .select()
            .from(paperDocs)
            .where(eq(paperDocs.id, saved.id))
        )[0]?.crdtDocument
      ).toEqual(saved.document)
    })
)

it.each(["cv", "letter"] as const)(
  "saved fake %s worker preserves block IDs independently of focus flags",
  (kind) =>
    fixture(async ({ ownerId, taskId, db }, registry) => {
      const saved = await savedRichWord(db, ownerId, kind)
      const grounding = await resolveTurnGrounding({
        registry,
        actor: personActor(ownerId),
        requestFocusDocId: saved.id,
        storedKind: null,
        storedId: null,
        context: [],
        memoryEnabled: false,
      })
      await getDb()
        .update(coachTasks)
        .set({
          contextSnapshot: {
            messages: [],
            focusDoc: grounding.focusDoc,
            context: [{ kind: "paper", id: saved.id, blockIds: ["after"] }],
          },
        })
        .where(eq(coachTasks.id, taskId))
      await runCoachWorker({
        ...settings,
        registry,
        runtime: (task) => createTaskRuntime(task, registry),
      })
      const [pending] = await getDb().select().from(pendingActions)
      expect(pending?.input).toMatchObject({
        docId: saved.id,
        edits: [{ blockId: "after" }],
      })
      expect(
        (
          await getDb()
            .select()
            .from(paperDocs)
            .where(eq(paperDocs.id, saved.id))
        )[0]?.crdtDocument
      ).toEqual(saved.document)
    })
)

it.each(["cv", "letter"] as const)(
  "refuses unresolved selected %s text instead of choosing another paragraph",
  (kind) =>
    fixture(async ({ ownerId, db }, registry) => {
      const actor = personActor(ownerId)
      const saved = await savedRichWord(db, ownerId, kind)
      for (const blockId of ["missing", "table", "cell-text", "photo"]) {
        await expect(
          resolveTurnGrounding({
            registry,
            actor,
            requestFocusDocId: saved.id,
            storedKind: null,
            storedId: null,
            context: [{ kind: "paper", id: saved.id, blockIds: [blockId] }],
            memoryEnabled: false,
          })
        ).rejects.toThrow(/selected passage/i)
      }
      const read = richReadOutputSchema.parse(
        await registry.read(
          "paper.readRich",
          { docId: saved.id, writer: RICH_NATIVE_WRITER },
          actor
        )
      )
      const focus = {
        id: saved.id,
        revision: 0,
        nativeBasis: read.basis,
        outline: read.outline,
      }
      expect(() => fakePaperIntent(focus, ["missing"])).toThrow(
        /selected passage/i
      )
      expect(
        (
          await getDb()
            .select()
            .from(paperDocs)
            .where(eq(paperDocs.id, saved.id))
        )[0]?.crdtDocument
      ).toEqual(saved.document)
      expect(await getDb().select().from(pendingActions)).toEqual([])
    })
)
