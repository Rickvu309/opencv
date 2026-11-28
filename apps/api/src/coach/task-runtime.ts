import { z } from "zod"
import { eq } from "drizzle-orm"
import { planSchema } from "@workspace/domain/account"
import { coachModeSchema } from "@workspace/domain/coach"
import { coachActor } from "@workspace/domain/kernel"
import { nativeBasisSchema } from "@workspace/domain/paper-doc"
import { operation as setJobPriority } from "@workspace/domain/operations/job/set-priority"
import { coachModelEnv } from "../platform/config.js"
import { getDb } from "../db/context.js"
import { coachUsage } from "../db/schema.js"
import type { Registry } from "../registry/registry.js"
import { streamAnthropicSteps } from "./anthropic-runtime.js"
import {
  createScriptedWorkerRuntime,
  FAKE_PROPOSED_EDIT_TEXT,
  fakePaperEdit,
} from "./fake.js"
import { paperStartAsk, paperStartRuntime } from "./fake-paper-start.js"
import { modelMessageSchema, type WorkerRuntime } from "./model-step.js"
import { COACH_STABLE_PROMPT } from "./prompt.js"
import { routeCoachModel } from "./router.js"
import type { Task } from "./task-types.js"

const contextSchema = z.object({
  messages: modelMessageSchema.array(),
  focusDoc: z
    .object({
      id: z.string(),
      revision: z.number(),
      outline: z.string(),
      nativeBasis: nativeBasisSchema.optional(),
      engine: z.literal(2).optional(),
    })
    .optional(),
  context: z.array(z.object({ kind: z.string(), id: z.string() })).optional(),
})

export function createTaskRuntime(
  task: Task,
  registry: Registry
): WorkerRuntime {
  if (task.modelId === "fake") return demoTaskRuntime(task)
  return async function* (input) {
    const [usage] = await getDb()
      .select()
      .from(coachUsage)
      .where(eq(coachUsage.coachTaskId, task.id))
    if (!usage) throw new Error("Task usage missing")
    const actor = coachActor(task.ownerId, task.chatId, usage.id)
    yield* streamAnthropicSteps({
      model: routeCoachModel({
        plan: planSchema.parse(task.planAtStart),
        mode: coachModeSchema.parse(task.mode),
        env: coachModelEnv(),
      }),
      system: COACH_STABLE_PROMPT,
      uncached: `Context: ${JSON.stringify(task.contextSnapshot)}`,
      history: [],
      messages: input.messages,
      entries: task.toolsAllowed ? await registry.tools(actor) : [],
      registry,
      actor,
      signal: input.signal,
      mode: coachModeSchema.parse(task.mode),
      boundary: input.boundary,
      maxSteps: input.maxSteps,
      maxTokens: input.maxTokens,
    })
  }
}

function demoTaskRuntime(task: Task): WorkerRuntime {
  const context = contextSchema.parse(task.contextSnapshot)
  const focus = context.focusDoc
  const jobId = context.context?.find((item) => item.kind === "job")?.id
  const intents = !task.toolsAllowed
    ? []
    : focus
      ? [
          {
            id: "call_edit",
            name: "paper.edit" as const,
            input: fakePaperEdit(focus),
          },
        ]
      : jobId
        ? [
            {
              id: "call_priority",
              name: setJobPriority.name,
              input: { jobId, priority: "high" },
            },
          ]
        : [{ id: "call_list", name: "job.list" as const, input: {} }]
  const startKind =
    task.toolsAllowed && !focus ? paperStartAsk(context.messages) : null
  const runtime = startKind
    ? paperStartRuntime(startKind, jobId)
    : createScriptedWorkerRuntime([
        {
          text: "I looked at the context. ",
          intents,
          inputTokens: 20,
          outputTokens: 10,
        },
        {
          text: focus
            ? FAKE_PROPOSED_EDIT_TEXT
            : jobId
              ? "I updated the Job priority."
              : "Prep the starred Job next.",
          intents: [],
          inputTokens: 10,
          outputTokens: 10,
        },
      ])
  return async function* (input) {
    await new Promise<void>((resolve, reject) => {
      const abort = () => {
        clearTimeout(timer)
        reject(input.signal.reason)
      }
      const timer = setTimeout(() => {
        input.signal.removeEventListener("abort", abort)
        resolve()
      }, 2000)
      input.signal.addEventListener("abort", abort, { once: true })
      if (input.signal.aborted) abort()
    })
    yield* runtime(input)
  }
}
