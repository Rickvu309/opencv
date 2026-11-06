import { randomUUID } from "node:crypto"
import { coachStartOutputSchema } from "@workspace/domain"
import { expect } from "vitest"
import {
  idOf,
  type CoverageCase,
  type CoverageTools,
} from "./coverage-helpers.js"

export function coachCases({
  ctx,
  run,
  registry,
}: CoverageTools): CoverageCase[] {
  return [
    {
      name: "coach.start",
      arrange: async () => {
        ctx.chatId = idOf(
          (await run("chat.create", { title: "Durable Coach" })).output
        )
      },
      act: async () => {
        const prior = process.env.COACH_TASK_WORKER
        try {
          process.env.COACH_TASK_WORKER = "internal"
          return await run("coach.start", {
            chatId: ctx.chatId,
            startKey: randomUUID(),
            text: "Help me prepare",
          })
        } finally {
          if (prior === undefined) delete process.env.COACH_TASK_WORKER
          else process.env.COACH_TASK_WORKER = prior
        }
      },
      assert: async (result) => {
        const {
          createScriptedWorkerRuntime,
          taskCatalogDigest,
          COACH_TASK_RUNTIME_VERSION,
          runCoachWorker,
        } = await import("../coach/index.js")
        expect(coachStartOutputSchema.parse(result.output).chatId).toBe(
          ctx.chatId
        )
        expect(
          await runCoachWorker({
            env: { COACH_TASK_WORKER: "internal" },
            workerId: "coverage",
            registry,
            catalogDigest: taskCatalogDigest(registry),
            runtimeVersion: COACH_TASK_RUNTIME_VERSION,
            runtime: () =>
              createScriptedWorkerRuntime([
                {
                  text: "Ready.",
                  intents: [],
                  inputTokens: 1,
                  outputTokens: 1,
                },
              ]),
          })
        ).toBe(true)
      },
    },
  ]
}
