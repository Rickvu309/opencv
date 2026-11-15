import {
  NATIVE_WRITER,
  paperViewSchema,
  nativePaperDocumentSchema,
  personActor,
} from "@workspace/domain"
import { eq } from "drizzle-orm"
import { expect, it } from "vitest"
import { getDb } from "../db/context.js"
import {
  activity,
  coachTasks,
  paperDocs,
  paperDocUpdates,
  pendingActions,
  toolIntents,
} from "../db/schema.js"
import { seedColumns } from "../paper/content-document.js"
import { resolveTurnGrounding } from "./context.js"
import { createTaskRuntime } from "./task-runtime.js"
import { runCoachWorker } from "./worker.js"
import { claim, finalize, runIntent } from "./task-store.js"
import { fixture, settings } from "./worker-fixture.js"

it.each([
  "approve",
  "stale",
  "epoch",
  "revision",
  "digest",
  "provenance",
] as const)(
  "saved fake native proposal: %s, immutable retry and receipt Undo",
  (decision) =>
    fixture(async ({ taskId, ownerId }, registry) => {
      const actor = personActor(ownerId)
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
      const created = await registry.execute({
        name: "paper.create",
        input: {
          kind: "letter",
          document: {
            version: 3,
            kind: "letter",
            clashes: [],
            blocks: [{ id: "p1", type: "paragraph", content: "Legacy" }],
          },
        },
        actor,
      })
      const docId = paperViewSchema.parse(created.output).id
      await getDb()
        .update(paperDocs)
        .set(seedColumns("letter", native))
        .where(eq(paperDocs.id, docId))
      const read = async () =>
        paperViewSchema.parse(
          await registry.read(
            "paper.get",
            { docId, writer: NATIVE_WRITER },
            actor
          )
        )
      const grounding = await resolveTurnGrounding({
        registry,
        actor,
        requestFocusDocId: docId,
        storedKind: null,
        storedId: null,
        memoryEnabled: false,
      })
      const initial = await read()
      await getDb()
        .update(coachTasks)
        .set({
          contextSnapshot: JSON.parse(
            JSON.stringify({ messages: [], focusDoc: grounding.focusDoc })
          ),
        })
        .where(eq(coachTasks.id, taskId))
      const runtime: Parameters<typeof runCoachWorker>[0]["runtime"] = (task) =>
        createTaskRuntime(task, registry)
      const receiptsBeforeProposal = await getDb().select().from(activity)
      await runCoachWorker({ ...settings, registry, runtime })
      expect(await getDb().select().from(activity)).toEqual(
        receiptsBeforeProposal
      )
      expect((await getDb().select().from(coachTasks))[0]?.state).toBe(
        "waitingApproval"
      )
      expect(await read()).toEqual(initial)
      const [intent] = await getDb().select().from(toolIntents)
      const [proposal] = await getDb().select().from(pendingActions)
      const original = structuredClone(intent!.input)
      expect(original).toMatchObject({
        docId,
        basedOn: grounding.focusDoc!.revision,
        nativeBasis: grounding.focusDoc!.nativeBasis,
        writer: NATIVE_WRITER,
      })
      expect(proposal?.input).toEqual(original)
      const beforeReceipts = await getDb().select().from(activity)
      if (decision !== "approve") {
        if (decision === "stale") {
          await registry.execute({
            name: "paper.edit",
            input: {
              docId,
              basedOn: initial.contentVersion,
              writer: NATIVE_WRITER,
              nativeBasis: initial.nativeBasis,
              edits: [
                { op: "setText", blockId: "p1", text: "Person continued" },
              ],
            },
            actor,
          })
        } else {
          const changed = nativePaperDocumentSchema.parse({
            ...native,
            blocks: [
              {
                id: "p1",
                type: "paragraph",
                content: [{ text: "Changed digest 😀", underline: true }],
              },
            ],
          })
          if (decision === "epoch")
            await getDb()
              .update(paperDocs)
              .set({ crdtEpoch: initial.nativeBasis!.epoch + 1 })
              .where(eq(paperDocs.id, docId))
          if (decision === "revision")
            await getDb()
              .update(paperDocs)
              .set({ contentVersion: initial.contentVersion + 1 })
              .where(eq(paperDocs.id, docId))
          if (decision === "digest")
            await getDb()
              .update(paperDocs)
              .set(seedColumns("letter", changed))
              .where(eq(paperDocs.id, docId))
          if (decision === "provenance")
            await getDb()
              .update(paperDocs)
              .set({ crdtDocument: { ...native, schemaRevision: 2 } })
              .where(eq(paperDocs.id, docId))
        }
        const snapshot = async () => ({
          documents: await getDb().select().from(paperDocs),
          updates: await getDb().select().from(paperDocUpdates),
          receipts: await getDb().select().from(activity),
        })
        const beforeRefusal = await snapshot()
        await expect(
          registry.approve(ownerId, proposal!.id)
        ).rejects.toMatchObject({
          code: decision === "provenance" ? "VALIDATION_ERROR" : "CONFLICT",
        })
        expect(await snapshot()).toEqual(beforeRefusal)
        expect((await getDb().select().from(pendingActions))[0]?.status).toBe(
          "pending"
        )
      } else {
        await expect(
          registry.approve(ownerId, proposal!.id).then(() => {
            throw new Error("Approval response lost after commit")
          })
        ).rejects.toThrow("Approval response lost after commit")
        const receipt = await registry.approve(ownerId, proposal!.id)
        expect(receipt).toBeTruthy()
        expect((await registry.approve(ownerId, proposal!.id))?.id).toBe(
          receipt!.id
        )
        expect(await getDb().select().from(activity)).toHaveLength(
          beforeReceipts.length + 1
        )
        const after = await read()
        expect(after.paper.version).toBe(4)
        expect(after.nativeBasis).not.toEqual(initial.nativeBasis)
        const fresh = await resolveTurnGrounding({
          registry,
          actor,
          requestFocusDocId: docId,
          storedKind: null,
          storedId: null,
          memoryEnabled: false,
        })
        expect(fresh.focusDoc?.nativeBasis).toEqual(after.nativeBasis)
        const recovered = await claim({
          workerId: "native-recovery",
          leaseMs: 60000,
        })
        expect(recovered).toBeTruthy()
        const replayIntent = { ...intent!, kind: "command" as const }
        await expect(
          runIntent(recovered!.lease, replayIntent, registry).then(() => {
            throw new Error("Task effect response lost after commit")
          })
        ).rejects.toThrow("Task effect response lost after commit")
        const replay = await runIntent(recovered!.lease, replayIntent, registry)
        const [stored] = await getDb().select().from(toolIntents)
        expect(stored?.intentKey).toBe(intent!.intentKey)
        expect(replay).toEqual(stored?.publicResult)
        expect(await getDb().select().from(activity)).toHaveLength(
          beforeReceipts.length + 1
        )
        await finalize(recovered!.lease, "succeeded")
        expect(await getDb().select().from(toolIntents)).toHaveLength(1)
        expect((await getDb().select().from(toolIntents))[0]?.input).toEqual(
          original
        )
        await registry.undo(ownerId, receipt!.id)
        expect((await read()).paper).toEqual(native)
      }
      expect((await getDb().select().from(pendingActions))[0]?.input).toEqual(
        original
      )
    })
)
