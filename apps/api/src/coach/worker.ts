import { z } from "zod"
import { coachActor } from "@workspace/domain/kernel"
import { getDb } from "../db/context.js"
import { coachUsage } from "../db/schema.js"
import { eq } from "drizzle-orm"
import type { Registry } from "../registry/registry.js"
import {
  append,
  claim,
  inputHash,
  intentKey,
  persistStep,
  renew,
  runIntent,
} from "./task-store.js"
import {
  modelMessageSchema,
  type ModelMessage,
  type WorkerRuntime,
} from "./model-step.js"
import type { Checkpoint, Task, Intent } from "./task-types.js"
import {
  outputBlocksAnotherStep,
  providerOutputLimit,
  TaskBudgetError,
} from "./task-budget.js"
import {
  finishTask,
  pauseTask,
  recoverWaitingTasks,
  restoreTask,
  retryTask,
} from "./worker-store.js"

const contextSchema = z.object({ messages: modelMessageSchema.array() })
const paused = new Error("Task waiting for approval")

class TaskDeadlineError extends Error {
  constructor() {
    super("Task deadline exceeded")
  }
}

export async function runCoachWorker(options: {
  workerId: string
  registry: Registry
  runtime: (task: Task) => WorkerRuntime
  catalogDigest: string
  runtimeVersion: number
  env?: NodeJS.ProcessEnv
  leaseMs?: number
  scheduleRenewal?: (renew: () => Promise<void>) => () => void
}) {
  const leaseMs = options.leaseMs ?? 30_000
  await options.registry.expireTaskApprovals()
  await recoverWaitingTasks()
  const claimed = await claim({ workerId: options.workerId, leaseMs })
  if (!claimed) return false
  const { row: task, lease } = claimed
  const controller = new AbortController()
  let stopped = false
  let renewing = Promise.resolve()
  const tick = () => {
    renewing = renewing.then(async () => {
      if (stopped) return
      try {
        const state = await renew(lease, leaseMs)
        if (state === "cancelling")
          controller.abort(new Error("Task cancelled"))
      } catch (error) {
        controller.abort(error)
      }
    })
    return renewing
  }
  const schedule =
    options.scheduleRenewal ??
    ((tick: () => Promise<void>) => {
      const timer = setInterval(
        () => {
          void tick()
        },
        Math.max(1, Math.floor(leaseMs / 3))
      )
      return () => clearInterval(timer)
    })
  const stopRenewal = schedule(tick)
  try {
    if (task.cancelRequestedAt) {
      await finishTask(lease, "cancelled", options.registry)
      return true
    }
    if (task.deadlineAt.getTime() <= Date.now()) throw new TaskDeadlineError()
    if (
      task.catalogDigest !== options.catalogDigest ||
      task.runtimeVersion !== options.runtimeVersion
    )
      throw new Error("Task runtime unavailable")
    const [usage] = await getDb()
      .select()
      .from(coachUsage)
      .where(eq(coachUsage.coachTaskId, task.id))
    if (!usage) throw new Error("Task usage missing")
    const entries = task.toolsAllowed
      ? await options.registry.tools(
          coachActor(task.ownerId, task.chatId, usage.id)
        )
      : []
    let { checkpoint } = await restoreTask(task.id)
    let messages = checkpoint
      ? modelMessageSchema.array().parse(checkpoint.modelMessages)
      : contextSchema.parse(task.contextSnapshot).messages
    let step = checkpoint ? checkpoint.completedStep + 1 : 0
    let tokens = checkpoint?.usage ?? { inputTokens: 0, outputTokens: 0 }
    const complete = async (saved: Checkpoint) => {
      let restored = await restoreTask(task.id)
      const deferred: Intent[] = []
      for (const intent of restored.intents) {
        controller.signal.throwIfAborted()
        if (
          restored.intents.some((row) => row.state === "proposed") &&
          intent.state === "planned" &&
          !options.registry.taskRequiresApproval(intent.operation, intent.input)
        ) {
          deferred.push(intent)
          continue
        }
        await runIntent(lease, intent, options.registry)
        restored = await restoreTask(task.id)
      }
      if (await pauseTask(lease)) throw paused
      for (const intent of deferred) {
        controller.signal.throwIfAborted()
        await runIntent(lease, intent, options.registry)
      }
      restored = await restoreTask(task.id)
      const results: ModelMessage = {
        role: "user",
        content: restored.intents.map((intent) => ({
          type: "tool_result",
          tool_use_id: intent.providerToolUseId,
          content: JSON.stringify(intent.publicResult),
        })),
      }
      messages = modelMessageSchema.array().parse(saved.modelMessages)
      if (restored.intents.length) messages.push(results)
      await persistStep(
        lease,
        { ...saved, phase: "results", modelMessages: messages },
        []
      )
      return restored.intents
    }
    if (task.attempt > 1)
      await append(lease, {
        kind: "attemptRestarted",
        payload: { attempt: task.attempt },
        step,
      })
    if (checkpoint?.phase === "decision") {
      const intents = await complete(checkpoint)
      if (!intents.length) {
        await finishTask(lease, "succeeded", options.registry)
        return true
      }
      checkpoint = (await restoreTask(task.id)).checkpoint
    }
    if (
      checkpoint?.phase === "results" &&
      !(await restoreTask(task.id)).intents.length
    ) {
      await finishTask(lease, "succeeded", options.registry)
      return true
    }
    if (
      step >= task.maxSteps ||
      outputBlocksAnotherStep(tokens.outputTokens, task.maxTokens)
    )
      throw new TaskBudgetError()
    const outputs = new Map<string, { intent: Intent; result: unknown }>()
    const runtime = options.runtime(task)
    const stream = runtime({
      messages,
      completedSteps: step,
      signal: controller.signal,
      maxSteps: task.maxSteps - step,
      maxTokens: providerOutputLimit(tokens.outputTokens, task.maxTokens),
      boundary: {
        async persistStep(decision) {
          controller.signal.throwIfAborted()
          if (
            !decision.message ||
            !decision.usage ||
            decision.stopReason === "refusal" ||
            decision.stopReason === "max_tokens"
          )
            throw new Error("Incomplete model decision")
          tokens = {
            inputTokens: tokens.inputTokens + decision.usage.inputTokens,
            outputTokens: tokens.outputTokens + decision.usage.outputTokens,
            cacheCreationInputTokens:
              (tokens.cacheCreationInputTokens ?? 0) +
              (decision.usage.cacheCreationInputTokens ?? 0),
            cacheReadInputTokens:
              (tokens.cacheReadInputTokens ?? 0) +
              (decision.usage.cacheReadInputTokens ?? 0),
          }
          const intents: Intent[] = decision.intents.map((intent, slot) => {
            const entry = entries.find((entry) => entry.name === intent.name)
            if (!entry) throw new Error("Task tool unavailable")
            return {
              step,
              slot,
              intentKey: intentKey(task.id, step, slot),
              providerToolUseId: intent.id,
              operation: entry.name,
              operationVersion: 1,
              input: entry.input.parse(intent.input),
              inputHash: inputHash(entry.input.parse(intent.input)),
              observedRevisions: [],
              kind: entry.kind,
            }
          })
          const saved: Checkpoint = {
            completedStep: step,
            phase: "decision",
            modelMessages: [...messages, decision.message],
            usage: tokens,
            observedRevisions: [],
            requestManifest: {
              model: task.modelId,
              stopReason: decision.stopReason,
            },
          }
          await persistStep(lease, saved, intents)
          const completed = await complete(saved)
          outputs.clear()
          for (const intent of completed)
            outputs.set(intent.providerToolUseId, {
              intent,
              result: intent.publicResult,
            })
          step++
        },
        async runIntent(intent) {
          controller.signal.throwIfAborted()
          const saved = outputs.get(intent.id)
          if (
            !saved ||
            saved.intent.operation !== intent.name ||
            saved.intent.inputHash !== inputHash(intent.input)
          )
            throw new Error("Unplanned model callback")
          return JSON.stringify(saved.result)
        },
      },
    })
    let draft = ""
    for await (const part of stream) {
      controller.signal.throwIfAborted()
      if (part.type === "text-delta") {
        draft += part.text
        if (draft.length >= 1024) {
          await append(lease, { kind: "draft", payload: { text: draft }, step })
          draft = ""
        }
      }
      if (part.type === "error") throw new Error(part.message)
    }
    if (draft)
      await append(lease, { kind: "draft", payload: { text: draft }, step })
    const restored = await restoreTask(task.id)
    if (!restored.checkpoint)
      throw new Error("Task stopped before a reply was saved")
    if (restored.intents.length) {
      if (step >= task.maxSteps) throw new TaskBudgetError()
      throw new Error("Task stopped before a reply was saved")
    }
    await finishTask(lease, "succeeded", options.registry)
  } catch (error) {
    if (error === paused) return true
    controller.abort(error)
    const { coachTasks } = await import("../db/schema.js")
    const [current] = await getDb()
      .select()
      .from(coachTasks)
      .where(eq(coachTasks.id, task.id))
    if (
      !current ||
      current.leaseEpoch !== lease.epoch ||
      current.leaseOwner !== lease.workerId
    )
      return true
    const status = z.object({ status: z.number() }).safeParse(error)
    const transient =
      (status.success &&
        (status.data.status === 429 || status.data.status >= 500)) ||
      (error instanceof Error &&
        ["APIConnectionError", "APIConnectionTimeoutError"].includes(
          error.name
        ))
    if (!current.cancelRequestedAt && transient && (await retryTask(lease)))
      return true
    console.error("Coach task failed", { taskId: lease.taskId, error })
    await finishTask(
      lease,
      current.cancelRequestedAt ? "cancelled" : "failed",
      options.registry,
      error instanceof TaskDeadlineError
        ? "DEADLINE_EXCEEDED"
        : error instanceof TaskBudgetError
          ? "BUDGET_EXCEEDED"
          : "TASK_FAILED"
    )
  } finally {
    stopped = true
    stopRenewal()
    controller.abort()
    await renewing
  }
  return true
}
