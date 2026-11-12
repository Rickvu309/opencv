import {
  personActor,
  parseUserId,
  parseChatId,
  paperContract,
} from "@workspace/domain"
import { eq, sql } from "drizzle-orm"
import { expect, it, vi } from "vitest"
import { z } from "zod"
import { getDb } from "../db/context.js"
import {
  chatMessages,
  coachTasks,
  jobs,
  pendingActions,
  taskCheckpoints,
  toolIntents,
} from "../db/schema.js"
import { createScriptedWorkerRuntime } from "./fake.js"
import { claim } from "./task-store.js"
import { runCoachWorker } from "./worker.js"
import { getChat } from "../chat/index.js"
import { readStoredParts } from "../chat/index.js"
import { open, apply } from "../paper/word/document.js"
import { twoParagraphCv } from "../test/paper-content.js"
import { resolveTurnGrounding } from "./context.js"
import { createTaskRuntime } from "./task-runtime.js"
import { final, fixture, settings } from "../test/coach-worker-fixture.js"

it.each(["approve", "deny", "expire", "undo"] as const)(
  "pauses without a lease, resolves %s and resumes the checkpoint",
  (resolution) =>
    fixture(async ({ taskId, ownerId }, registry) => {
      const created = await registry.execute({
        name: "job.create",
        input: { title: "Role", company: "Acme" },
        actor: personActor(ownerId),
      })
      const jobId = z.object({ id: z.string() }).parse(created.output).id
      const script = [
        {
          ...final,
          intents: [
            {
              id: "delete",
              name: "job.move" as const,
              input: { jobId, stage: "applied" },
            },
          ],
        },
        final,
      ]
      const runtime = () => createScriptedWorkerRuntime(script)
      await runCoachWorker({ ...settings, registry, runtime })
      const [waiting] = await getDb().select().from(coachTasks)
      expect(waiting).toMatchObject({
        state: "waitingApproval",
        leaseOwner: null,
        leaseUntil: null,
      })
      expect(await claim({ workerId: "other", leaseMs: 60000 })).toBeNull()
      const [proposal] = await getDb().select().from(pendingActions)
      if (resolution === "approve" || resolution === "undo") {
        const receipt = await registry.approve(ownerId, proposal!.id)
        expect((await registry.approve(ownerId, proposal!.id))?.id).toBe(
          receipt?.id
        )
        expect(
          (await registry.confirmations(ownerId, waiting!.chatId))[0]?.receipt
            ?.activityId
        ).toBe(receipt?.id)
      } else if (resolution === "deny")
        await registry.deny(ownerId, proposal!.id)
      else {
        await getDb()
          .update(pendingActions)
          .set({ createdAt: sql`clock_timestamp() - interval '25 hours'` })
          .where(eq(pendingActions.id, proposal!.id))
        await registry.expireTaskApprovals()
      }
      expect((await getDb().select().from(coachTasks))[0]?.state).toBe("queued")
      await runCoachWorker({ ...settings, registry, runtime })
      expect((await getDb().select().from(coachTasks))[0]?.state).toBe(
        "succeeded"
      )
      expect(await getDb().select().from(jobs)).toHaveLength(1)
      const decisions = await getDb().select().from(taskCheckpoints)
      expect(decisions.filter((row) => row.phase === "decision")).toHaveLength(
        2
      )
      expect((await getDb().select().from(toolIntents))[0]?.state).toBe(
        resolution === "approve" || resolution === "undo"
          ? "committed"
          : "denied"
      )
      const reload = () =>
        getChat(parseUserId(ownerId), parseChatId(waiting!.chatId))
      const parts = (await reload()).messages
        .flatMap((message) => message.parts)
        .filter((part) => part.type === "tool")
      const outcome =
        resolution === "expire"
          ? "expired"
          : resolution === "deny"
            ? "denied"
            : "approved"
      expect(parts).toHaveLength(1)
      expect(parts[0]).toMatchObject({ name: "job.move", outcome })
      if (resolution === "deny" || resolution === "expire") {
        expect(parts[0]).toMatchObject({ approval: outcome })
        const saved = (await getDb().select().from(chatMessages)).find(
          (message) => message.role === "coach"
        )
        expect(
          readStoredParts(saved!.parts).filter((part) => part.type === "tool")
        ).toMatchObject([{ type: "tool", outcome }])
      } else {
        expect(parts[0]?.activityId).toBeTruthy()
        if (resolution === "undo") {
          await registry.undo(ownerId, parts[0]!.activityId!)
          expect(
            (await reload()).messages
              .flatMap((message) => message.parts)
              .find((part) => part.type === "tool")
          ).toMatchObject({ outcome: "undone", undone: true })
          expect(await getDb().select().from(jobs)).toHaveLength(1)
        }
      }
      expect(taskId).toBe(waiting?.id)
    })
)

it.each(["blank", "with words", "template"] as const)(
  "the durable fake proposes a valid edit for %s",
  (state) =>
    fixture(async ({ taskId, ownerId }, registry) => {
      vi.stubEnv("PAPER_PACKAGE_ENABLED", "true")
      try {
        let docId: string
        if (state === "template") {
          const result = await registry.execute({
            name: "paper.create",
            input: {
              kind: "cv",
              name: "Practice CV",
              document: twoParagraphCv,
            },
            actor: personActor(ownerId),
          })
          docId = z.object({ id: z.string() }).parse(result.output).id
        } else {
          const page = await open(ownerId, {
            kind: "mint",
            name: "Practice CV",
            label: "cv",
          })
          if ("refused" in page) throw new Error(page.message)
          docId = page.doc
          if (state === "with words") {
            const result = await apply(ownerId, {
              doc: page.doc,
              basedOn: page.revision,
              ops: [
                {
                  op: "setText",
                  handle: page.paragraphs[0]!.handle,
                  text: "Built tools for students.",
                },
              ],
            })
            if (result.refused) throw new Error(result.message)
          }
        }
        const grounding = await resolveTurnGrounding({
          registry,
          actor: personActor(ownerId),
          requestFocusDocId: docId,
          storedKind: null,
          storedId: null,
          memoryEnabled: false,
        })
        expect(grounding.focusDoc).toBeDefined()
        await getDb()
          .update(coachTasks)
          .set({
            contextSnapshot: { messages: [], focusDoc: grounding.focusDoc },
          })
          .where(eq(coachTasks.id, taskId))
        const runtime: Parameters<typeof runCoachWorker>[0]["runtime"] = (
          task
        ) => createTaskRuntime(task, registry)
        await runCoachWorker({ ...settings, registry, runtime })
        expect((await getDb().select().from(coachTasks))[0]?.state).toBe(
          "waitingApproval"
        )
        const [intent] = await getDb().select().from(toolIntents)
        expect(
          paperContract["paper.edit"].input.safeParse(intent?.input).success
        ).toBe(true)
        await registry.deny(ownerId, intent!.proposalId!)
        await runCoachWorker({ ...settings, registry, runtime })
        const [task] = await getDb().select().from(coachTasks)
        expect(task?.state).toBe("succeeded")
        expect(
          (
            await getChat(parseUserId(ownerId), parseChatId(task!.chatId))
          ).messages
            .flatMap((message) => message.parts)
            .filter((part) => part.type === "tool")
        ).toMatchObject([{ name: "paper.edit", outcome: "denied" }])
      } finally {
        vi.unstubAllEnvs()
      }
    })
)
