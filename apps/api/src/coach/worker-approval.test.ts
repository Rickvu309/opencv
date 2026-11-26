import { personActor, parseUserId, parseChatId } from "@workspace/domain/kernel"
import { eq, sql } from "drizzle-orm"
import { expect, it } from "vitest"
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
import { getChat } from "./chat/index.js"
import { readChatViewParts } from "./chat/index.js"
import { final, fixture, settings } from "./worker-fixture.test-support.js"

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
      const jobsBefore = await getDb().select().from(jobs)
      expect(jobsBefore).toMatchObject([{ id: jobId, stage: "saved" }])
      const script = [
        {
          ...final,
          intents: [
            {
              id: "move",
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
      if (resolution === "approve" || resolution === "undo")
        expect(await getDb().select().from(jobs)).toMatchObject([
          { id: jobId, stage: "applied" },
        ])
      else expect(await getDb().select().from(jobs)).toEqual(jobsBefore)
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
      const saved = (await getDb().select().from(chatMessages)).find(
        (message) => message.role === "coach"
      )
      expect(
        readChatViewParts(saved!.parts).filter((part) => part.type === "tool")
      ).toMatchObject([{ type: "tool", name: "job.move", outcome }])
      if (resolution === "deny" || resolution === "expire") {
        expect(parts[0]).toMatchObject({ approval: outcome })
      } else {
        expect(parts[0]?.activityId).toBeTruthy()
        if (resolution === "undo") {
          await registry.undo(ownerId, parts[0]!.activityId!)
          expect(
            (await reload()).messages
              .flatMap((message) => message.parts)
              .find((part) => part.type === "tool")
          ).toMatchObject({ outcome: "undone", undone: true })
          expect(await getDb().select().from(jobs)).toMatchObject([
            { id: jobId, stage: "saved" },
          ])
        }
      }
      expect(taskId).toBe(waiting?.id)
    })
)
