import { personActor, parseUserId, parseChatId } from "@workspace/domain"
import { expect, it } from "vitest"
import { z } from "zod"
import { getDb } from "../db/context.js"
import { coachTasks, jobs } from "../db/schema.js"
import { getChat } from "../chat/index.js"
import { createScriptedWorkerRuntime } from "./fake.js"
import { requestCancel } from "./task-store.js"
import { runCoachWorker } from "./worker.js"
import { final, fixture, settings } from "./worker-fixture.js"

it("Stop while an approval waits saves a Not approved line, never Expired", () =>
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
    await requestCancel(taskId, ownerId)
    await runCoachWorker({ ...settings, registry, runtime })
    expect((await getDb().select().from(coachTasks))[0]?.state).toBe(
      "cancelled"
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
      summary: "Not approved · ask Coach again",
    })
    expect(JSON.stringify(tools)).not.toMatch(/Expired/)
  }))
