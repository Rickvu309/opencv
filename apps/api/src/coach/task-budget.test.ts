import { COACH_MODEL } from "@workspace/domain/coach"
import { coachActor } from "@workspace/domain/kernel"
import { eq, sql } from "drizzle-orm"
import { expect, it } from "vitest"
import { z } from "zod"
import { getDb, withDatabase } from "../db/context.js"
import {
  chatMessages,
  coachTasks,
  jobs,
  taskCheckpoints,
} from "../db/schema.js"
import { installRegistry } from "../install.js"
import { seedTask } from "../test/coach-task-support.js"
import { createMigratedTestDb } from "../test/harness.js"
import { anthropicFixtureResponse } from "./anthropic-fixture.js"
import {
  createAnthropicModel,
  createAnthropicWorkerRuntime,
} from "./anthropic-runtime.js"
import { createScriptedWorkerRuntime } from "./fake.js"
import type { WorkerRuntime } from "./model-step.js"
import { inputHash } from "./task-store.js"
import {
  COACH_STEP_OUTPUT_LIMIT,
  COACH_TASK_MAX_STEPS,
  COACH_TASK_OUTPUT_BUDGET,
  outputBlocksAnotherStep,
  outputOverBudget,
  providerOutputLimit,
} from "./task-budget.js"
import { runCoachWorker } from "./worker.js"

const scriptSchema = z.array(
  z.object({
    text: z.string(),
    intents: z.array(
      z.object({
        id: z.string(),
        name: z.literal("job.create"),
        input: z.unknown(),
      })
    ),
    inputTokens: z.number(),
    outputTokens: z.number(),
  })
)
const final = { text: "Saved.", intents: [], inputTokens: 2, outputTokens: 3 }
const settings = {
  env: {},
  workerId: "worker",
  catalogDigest: "test",
  runtimeVersion: 1,
}

async function fixture(
  run: (
    seed: Awaited<ReturnType<typeof seedTask>>,
    registry: ReturnType<typeof installRegistry>
  ) => Promise<void>
) {
  const { db, client } = await createMigratedTestDb()
  try {
    await withDatabase(db, async () => {
      const seed = await seedTask(inputHash)
      await getDb()
        .update(coachTasks)
        .set({ contextSnapshot: { messages: [], script: [final] } })
        .where(eq(coachTasks.id, seed.taskId))
      await run(seed, installRegistry())
    })
  } finally {
    await client.close()
  }
}

const storedRuntime: Parameters<typeof runCoachWorker>[0]["runtime"] = (
  task
) => {
  const context = z.object({ script: scriptSchema }).parse(task.contextSnapshot)
  return createScriptedWorkerRuntime(context.script)
}

it("fits eight full replies and stops the next one", () => {
  expect(COACH_TASK_MAX_STEPS).toBe(8)
  expect(COACH_STEP_OUTPUT_LIMIT).toBe(4096)
  expect(COACH_TASK_OUTPUT_BUDGET).toBe(8 * 4096)
  const beforeLast = 7 * COACH_STEP_OUTPUT_LIMIT
  expect(outputBlocksAnotherStep(beforeLast, COACH_TASK_OUTPUT_BUDGET)).toBe(
    false
  )
  expect(providerOutputLimit(beforeLast, COACH_TASK_OUTPUT_BUDGET)).toBe(4096)
  expect(
    outputOverBudget(COACH_TASK_OUTPUT_BUDGET, COACH_TASK_OUTPUT_BUDGET)
  ).toBe(false)
  expect(
    outputBlocksAnotherStep(COACH_TASK_OUTPUT_BUDGET, COACH_TASK_OUTPUT_BUDGET)
  ).toBe(true)
  expect(
    outputOverBudget(COACH_TASK_OUTPUT_BUDGET + 1, COACH_TASK_OUTPUT_BUDGET)
  ).toBe(true)
  expect(outputBlocksAnotherStep(beforeLast, 32000)).toBe(false)
  expect(providerOutputLimit(beforeLast, 32000)).toBe(3328)
  expect(outputOverBudget(32000, 32000)).toBe(false)
  expect(outputBlocksAnotherStep(32000, 32000)).toBe(true)
  expect(providerOutputLimit(0, 25000)).toBe(4096)
})

it.each(["steps", "tokens", "deadline", "catalog"])(
  "records a %s stop without retrying it",
  (budget) =>
    fixture(async ({ taskId, intent }, registry) => {
      const script = [
        {
          ...final,
          intents: [
            {
              id: intent.providerToolUseId,
              name: "job.create" as const,
              input: intent.input,
            },
          ],
        },
        final,
      ]
      await getDb()
        .update(coachTasks)
        .set({
          contextSnapshot: { messages: [], script },
          ...(budget === "steps" ? { maxSteps: 1 } : {}),
          ...(budget === "tokens" ? { maxTokens: 1 } : {}),
          ...(budget === "deadline"
            ? { deadlineAt: sql`clock_timestamp() - interval '1 second'` }
            : {}),
          ...(budget === "catalog" ? { catalogDigest: "unavailable" } : {}),
        })
        .where(eq(coachTasks.id, taskId))
      await runCoachWorker({ ...settings, registry, runtime: storedRuntime })
      const [task] = await getDb().select().from(coachTasks)
      expect(task?.state).toBe("failed")
      expect(task?.retryCount).toBe(0)
      expect(task?.errorCode).toBe(
        budget === "tokens" || budget === "steps"
          ? "BUDGET_EXCEEDED"
          : budget === "deadline"
            ? "DEADLINE_EXCEEDED"
            : "TASK_FAILED"
      )
      expect(await getDb().select().from(jobs)).toHaveLength(
        budget === "steps" ? 1 : 0
      )
    })
)

it("saves a tool turn when each step reports a large prompt", () =>
  fixture(async ({ intent }, registry) => {
    const seen: number[] = []
    const script = [
      {
        text: "Looking.",
        intents: [
          {
            id: intent.providerToolUseId,
            name: "job.create" as const,
            input: intent.input,
          },
        ],
        inputTokens: 23000,
        outputTokens: 40,
      },
      { text: "Saved.", intents: [], inputTokens: 23000, outputTokens: 40 },
    ]
    await getDb()
      .update(coachTasks)
      .set({ contextSnapshot: { messages: [], script }, maxTokens: 25000 })
    const runtime: WorkerRuntime = (input) => {
      seen.push(input.maxTokens)
      return createScriptedWorkerRuntime(script)(input)
    }
    await runCoachWorker({ ...settings, registry, runtime: () => runtime })
    expect((await getDb().select().from(coachTasks))[0]?.state).toBe(
      "succeeded"
    )
    expect(await getDb().select().from(jobs)).toHaveLength(1)
    expect(seen).toEqual([4096])
  }))

it("stops a runaway reply on output and does not retry it", () =>
  fixture(async ({ intent }, registry) => {
    const script = [
      {
        text: "First.",
        intents: [
          {
            id: intent.providerToolUseId,
            name: "job.create" as const,
            input: intent.input,
          },
        ],
        inputTokens: 20,
        outputTokens: 600,
      },
      {
        text: "Second.",
        intents: [
          {
            id: "second",
            name: "job.create" as const,
            input: { title: "Other role", company: "Acme" },
          },
        ],
        inputTokens: 20,
        outputTokens: 600,
      },
    ]
    await getDb()
      .update(coachTasks)
      .set({ contextSnapshot: { messages: [], script } })
    await runCoachWorker({
      ...settings,
      registry,
      runtime: () => createScriptedWorkerRuntime(script),
    })
    const [task] = await getDb().select().from(coachTasks)
    expect(task).toMatchObject({
      state: "failed",
      errorCode: "BUDGET_EXCEEDED",
      retryCount: 0,
    })
    expect(await getDb().select().from(jobs)).toHaveLength(1)
  }))

it("saves the step after a tool when the model reports a large prompt", () =>
  fixture(async ({ ownerId, taskId }, registry) => {
    await getDb()
      .update(coachTasks)
      .set({ modelId: COACH_MODEL, maxTokens: 25000 })
      .where(eq(coachTasks.id, taskId))
    const [task] = await getDb().select().from(coachTasks)
    const requests: unknown[] = []
    const usage = { inputTokens: 23000, outputTokens: 40 }
    const responses = [
      anthropicFixtureResponse(
        [
          {
            type: "tool-call",
            toolCallId: "create",
            toolName: "job_create",
            input: JSON.stringify({ title: "Engineer", company: "Acme" }),
          },
        ],
        undefined,
        usage
      ),
      anthropicFixtureResponse(
        [{ type: "text-delta", delta: "Done." }],
        undefined,
        usage
      ),
    ]
    const model = createAnthropicModel({
      apiKey: "fixture",
      maxRetries: 0,
      fetch: async (_url, init) => {
        requests.push(JSON.parse(String(init?.body)))
        const response = responses.shift()
        if (!response) throw new Error("Unexpected model request")
        return response
      },
    })
    const entries = await registry.tools(
      coachActor(ownerId, task!.chatId, "fixture")
    )
    await runCoachWorker({
      ...settings,
      registry,
      runtime: () =>
        createAnthropicWorkerRuntime({
          model,
          system: "Grounded",
          history: [],
          entries,
          registry,
          actor: coachActor(ownerId, task!.chatId, "fixture"),
        }),
    })
    const [saved] = await getDb().select().from(coachTasks)
    expect(saved).toMatchObject({
      state: "succeeded",
      errorCode: null,
      retryCount: 0,
    })
    expect((await getDb().select().from(chatMessages))[0]?.text).toBe("Done.")
    expect(await getDb().select().from(jobs)).toHaveLength(1)
    expect(requests).toHaveLength(2)
    expect((requests[1] as { max_tokens: number }).max_tokens).toBe(4096)
    const first = requests[0] as {
      tools: {
        name: string
        description?: string
        input_schema: { properties?: Record<string, unknown> }
      }[]
    }
    const start = first.tools.find((tool) => tool.name === "paper_start")
    const edit = first.tools.find((tool) => tool.name === "paper_edit")
    expect(first.tools.some((tool) => tool.name === "paper_create")).toBe(false)
    expect(Object.keys(start?.input_schema.properties ?? {}).sort()).toEqual([
      "jobId",
      "kind",
      "name",
      "templateId",
    ])
    expect(JSON.stringify(start?.input_schema).length).toBeLessThan(1000)
    expect(edit?.description).toContain("replaceText")
    expect(first.tools.some((tool) => tool.name === "job_list")).toBe(true)
    expect(first.tools.some((tool) => tool.name === "profile_get")).toBe(true)
  }))

it("stores a cut-off reply as a limit and does not try it again", () =>
  fixture(async ({ ownerId, taskId }, registry) => {
    await getDb()
      .update(coachTasks)
      .set({ modelId: COACH_MODEL })
      .where(eq(coachTasks.id, taskId))
    const [task] = await getDb().select().from(coachTasks)
    let requests = 0
    const model = createAnthropicModel({
      apiKey: "fixture",
      maxRetries: 0,
      fetch: async () => {
        requests += 1
        return anthropicFixtureResponse(
          [{ type: "text-delta", delta: "Here is half of a dra" }],
          "max_tokens"
        )
      },
    })
    const entries = await registry.tools(
      coachActor(ownerId, task!.chatId, "fixture")
    )
    await runCoachWorker({
      ...settings,
      registry,
      runtime: () =>
        createAnthropicWorkerRuntime({
          model,
          system: "Grounded",
          history: [],
          entries,
          registry,
          actor: coachActor(ownerId, task!.chatId, "fixture"),
        }),
    })
    const [saved] = await getDb().select().from(coachTasks)
    expect(saved).toMatchObject({
      state: "failed",
      errorCode: "BUDGET_EXCEEDED",
      retryCount: 0,
    })
    expect(requests).toBe(1)
    const texts = (await getDb().select().from(chatMessages)).map(
      (row) => row.text
    )
    expect(texts.join("\n")).not.toContain("Try again")
  }))

it("stores a cut-off tool call as a limit before reading its input", () =>
  fixture(async ({ ownerId, taskId }, registry) => {
    await getDb()
      .update(coachTasks)
      .set({ modelId: COACH_MODEL })
      .where(eq(coachTasks.id, taskId))
    const [task] = await getDb().select().from(coachTasks)
    let requests = 0
    const model = createAnthropicModel({
      apiKey: "fixture",
      maxRetries: 0,
      fetch: async () => {
        requests += 1
        return anthropicFixtureResponse(
          [
            {
              type: "tool-call",
              toolCallId: "cut",
              toolName: "paper_edit",
              input: "{}",
            },
          ],
          "max_tokens"
        )
      },
    })
    const entries = await registry.tools(
      coachActor(ownerId, task!.chatId, "fixture")
    )
    await runCoachWorker({
      ...settings,
      registry,
      runtime: () =>
        createAnthropicWorkerRuntime({
          model,
          system: "Grounded",
          history: [],
          entries,
          registry,
          actor: coachActor(ownerId, task!.chatId, "fixture"),
        }),
    })
    const [saved] = await getDb().select().from(coachTasks)
    expect(saved).toMatchObject({
      state: "failed",
      errorCode: "BUDGET_EXCEEDED",
      retryCount: 0,
    })
    expect(requests).toBe(1)
    const texts = (await getDb().select().from(chatMessages)).map(
      (row) => row.text
    )
    expect(texts.join("\n")).not.toContain("Try again")
  }))

it("adds a fresh copy and a later copy without mixing in the page", () =>
  fixture(async ({ ownerId, taskId }, registry) => {
    await getDb()
      .update(coachTasks)
      .set({ modelId: COACH_MODEL })
      .where(eq(coachTasks.id, taskId))
    const [task] = await getDb().select().from(coachTasks)
    const requests: { system?: unknown }[] = []
    const responses = [
      anthropicFixtureResponse(
        [
          {
            type: "tool-call",
            toolCallId: "create",
            toolName: "job_create",
            input: JSON.stringify({ title: "Engineer", company: "Acme" }),
          },
        ],
        undefined,
        {
          inputTokens: 10,
          outputTokens: 1,
          cacheCreationInputTokens: 100,
          cacheReadInputTokens: 0,
        }
      ),
      anthropicFixtureResponse(
        [{ type: "text-delta", delta: "Done." }],
        undefined,
        {
          inputTokens: 4,
          outputTokens: 2,
          cacheCreationInputTokens: 0,
          cacheReadInputTokens: 100,
        }
      ),
    ]
    const model = createAnthropicModel({
      apiKey: "fixture",
      maxRetries: 0,
      fetch: async (_url, init) => {
        requests.push(JSON.parse(String(init?.body)))
        const response = responses.shift()
        if (!response) throw new Error("Unexpected model request")
        return response
      },
    })
    const entries = await registry.tools(
      coachActor(ownerId, task!.chatId, "fixture")
    )
    await runCoachWorker({
      ...settings,
      registry,
      runtime: () =>
        createAnthropicWorkerRuntime({
          model,
          system: "Shared instructions",
          uncached: "Context: doc-secret-9f3a",
          history: [],
          entries,
          registry,
          actor: coachActor(ownerId, task!.chatId, "fixture"),
        }),
    })
    const rows = await getDb()
      .select()
      .from(taskCheckpoints)
      .where(eq(taskCheckpoints.taskId, taskId))
    const latest = rows.sort((a, b) => b.version - a.version)[0]
    expect(latest?.usage).toEqual({
      inputTokens: 14,
      outputTokens: 3,
      cacheCreationInputTokens: 100,
      cacheReadInputTokens: 100,
    })
    const system = requests[0]?.system as { text: string }[]
    expect(system[0]?.text).toBe("Shared instructions")
    expect(system[0]?.text).not.toContain("doc-secret-9f3a")
    expect(system[1]?.text).toBe("Context: doc-secret-9f3a")
  }))
