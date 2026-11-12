import { personActor, parseUserId, parseChatId } from "@workspace/domain"
import { eq, sql } from "drizzle-orm"
import { expect, it } from "vitest"
import { z } from "zod"
import { getDb } from "../db/context.js"
import { chatMessages, coachTasks, jobs, pendingActions } from "../db/schema.js"
import { getChat, readChatViewParts } from "../chat/index.js"
import { createScriptedWorkerRuntime } from "./fake.js"
import { requestCancel } from "./task-store.js"
import { runCoachWorker } from "./worker.js"
import { final, fixture, settings } from "./worker-fixture.js"

it.each([
  {
    ending: "stop",
    taskState: "cancelled",
    outcome: "stopped",
    summary: "Stopped · ask Coach again",
  },
  {
    ending: "expire",
    taskState: "succeeded",
    outcome: "expired",
    summary: "Expired · ask Coach again",
  },
] as const)(
  "an approval that ends by $ending is saved as $outcome and reloads as its own line",
  ({ ending, taskState, outcome, summary }) =>
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
      expect(waiting).toMatchObject({ id: taskId, state: "waitingApproval" })
      if (ending === "stop") await requestCancel(taskId, ownerId)
      else {
        await getDb()
          .update(pendingActions)
          .set({ createdAt: sql`clock_timestamp() - interval '25 hours'` })
          .where(eq(pendingActions.coachTaskId, taskId))
        await registry.expireTaskApprovals()
      }
      await runCoachWorker({ ...settings, registry, runtime })
      expect((await getDb().select().from(coachTasks))[0]?.state).toBe(
        taskState
      )
      expect(await getDb().select().from(jobs)).toMatchObject([
        { id: jobId, stage: "saved" },
      ])
      const tools = (
        await getChat(parseUserId(ownerId), parseChatId(waiting!.chatId))
      ).messages
        .flatMap((message) => message.parts)
        .filter((part) => part.type === "tool")
      expect(tools).toHaveLength(1)
      expect(tools[0]).toMatchObject({
        name: "job.move",
        ok: false,
        outcome,
        approval: outcome,
        summary,
      })
      const saved = (await getDb().select().from(chatMessages)).find(
        (message) => message.role === "coach"
      )
      expect(
        readChatViewParts(saved!.parts).filter((part) => part.type === "tool")
      ).toMatchObject([{ outcome, approval: outcome, summary }])
    })
)
