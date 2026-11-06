import { z } from "zod"
import { and, asc, desc, eq, sql } from "drizzle-orm"
import {
  appendCoachPart,
  chatToolNameSchema,
  errorEnvelope,
  parseChatId,
  parseUserId,
  textFromParts,
  type ChatEntryPart,
} from "@workspace/domain"
import { getDb, transaction } from "../db/context.js"
import {
  coachTasks,
  coachUsage,
  taskCheckpoints,
  toolIntents,
} from "../db/schema.js"
import { insertCoachMessage } from "../chat/index.js"
import { closeTaskApprovals, lockTask } from "../registry/task-fence.js"
import type { Registry } from "../registry/registry.js"
import { withMissingReceipts } from "./receipt.js"
import { append, finalize } from "./task-store.js"
import type { TaskLease } from "./task-types.js"

export async function restoreTask(taskId: string) {
  const [checkpoint] = await getDb()
    .select()
    .from(taskCheckpoints)
    .where(eq(taskCheckpoints.taskId, taskId))
    .orderBy(desc(taskCheckpoints.version))
    .limit(1)
  const intents = checkpoint
    ? await getDb()
        .select()
        .from(toolIntents)
        .where(
          and(
            eq(toolIntents.taskId, taskId),
            eq(toolIntents.step, checkpoint.completedStep)
          )
        )
        .orderBy(toolIntents.slot)
    : []
  return { checkpoint, intents }
}

export function pauseTask(lease: TaskLease) {
  return transaction(async () => {
    const task = await lockTask(lease)
    const unresolved = await getDb()
      .select()
      .from(toolIntents)
      .where(
        and(eq(toolIntents.taskId, task.id), eq(toolIntents.state, "proposed"))
      )
    if (!unresolved.length) return false
    await append(lease, {
      kind: "state",
      payload: { state: "waitingApproval" },
    })
    await lockTask(lease)
    await getDb()
      .update(coachTasks)
      .set({ state: "waitingApproval", leaseOwner: null, leaseUntil: null })
      .where(eq(coachTasks.id, task.id))
    return true
  })
}

export function recoverWaitingTasks() {
  return transaction(async () => {
    const rows = await getDb()
      .select()
      .from(coachTasks)
      .where(
        sql`${coachTasks.state} = 'waitingApproval' and (
      ${coachTasks.deadlineAt} <= clock_timestamp() or not exists (
        select 1 from ${toolIntents} where ${toolIntents.taskId} = ${coachTasks.id} and ${toolIntents.state} = 'proposed'
      ))`
      )
      .for("update", { skipLocked: true })
    for (const task of rows)
      await getDb()
        .update(coachTasks)
        .set({ state: "queued", availableAt: sql`clock_timestamp()` })
        .where(eq(coachTasks.id, task.id))
  })
}

export function finishTask(
  lease: TaskLease,
  state: "succeeded" | "failed" | "cancelled",
  registry: Registry,
  errorCode?: string
) {
  return transaction(async () => {
    const [existing] = await getDb()
      .select()
      .from(coachTasks)
      .where(eq(coachTasks.id, lease.taskId))
      .for("update")
    if (
      existing?.state === state &&
      existing.leaseEpoch === lease.epoch &&
      existing.leaseOwner === lease.workerId
    )
      return
    const task = await lockTask(lease, true, state !== "succeeded")
    if (state !== "succeeded") await closeTaskApprovals(task.id)
    const checkpoints = await getDb()
      .select()
      .from(taskCheckpoints)
      .where(
        and(
          eq(taskCheckpoints.taskId, task.id),
          eq(taskCheckpoints.phase, "decision")
        )
      )
      .orderBy(taskCheckpoints.completedStep)
    const { modelMessageSchema } = await import("./model-step.js")
    let parts: ChatEntryPart[] = []
    for (const checkpoint of checkpoints) {
      const messages = modelMessageSchema
        .array()
        .parse(checkpoint.modelMessages)
      const content = messages.at(-1)?.content
      const text =
        typeof content === "string"
          ? content
          : content
              ?.flatMap((block) => (block.type === "text" ? [block.text] : []))
              .join("")
      if (text) parts.push({ type: "text", text })
    }
    const usage = await getDb()
      .select()
      .from(coachUsage)
      .where(eq(coachUsage.coachTaskId, task.id))
    const outcomes = await getDb()
      .select()
      .from(toolIntents)
      .where(eq(toolIntents.taskId, task.id))
      .orderBy(asc(toolIntents.step), asc(toolIntents.slot))
    for (const intent of outcomes) {
      const denied =
        intent.state === "denied" ||
        (intent.state === "proposed" && state !== "succeeded")
      if (intent.state !== "read" && !denied) continue
      const summary = denied ? "Action was not approved" : intent.operation
      const result = z
        .object({ output: z.unknown().optional() })
        .parse(intent.publicResult ?? {})
      parts = appendCoachPart(parts, {
        type: "tool-result",
        toolCallId: intent.providerToolUseId,
        name: chatToolNameSchema.parse(intent.operation),
        summary,
        ok: !denied,
        result: denied
          ? errorEnvelope("CONFLICT", summary)
          : { ok: true, data: result.output ?? null },
      })
    }
    parts = withMissingReceipts(
      parts,
      await registry.turnReceipts(
        task.ownerId,
        usage.map((row) => row.id)
      )
    )
    const message = await insertCoachMessage({
      chatId: parseChatId(task.chatId),
      userId: parseUserId(task.ownerId),
      text: textFromParts(parts),
      parts,
      status:
        state === "succeeded"
          ? "final"
          : state === "cancelled"
            ? "aborted"
            : "error",
      workedMs: Math.max(0, Date.now() - task.createdAt.getTime()),
      supersedesMessageId: task.supersedesMessageId,
      autoTitle: true,
    })
    if (!message) {
      state = "failed"
      errorCode = "Task reply superseded"
    }
    if (message) {
      await getDb()
        .update(coachTasks)
        .set({ assistantMessageId: message.id })
        .where(eq(coachTasks.id, task.id))
      await getDb()
        .update(coachUsage)
        .set({ messageId: message.id })
        .where(eq(coachUsage.coachTaskId, task.id))
    }
    await getDb()
      .update(coachUsage)
      .set({
        finishReason: state,
        latencyMs: Math.max(0, Date.now() - task.createdAt.getTime()),
      })
      .where(eq(coachUsage.coachTaskId, task.id))
    if (errorCode)
      await getDb()
        .update(coachTasks)
        .set({ errorCode })
        .where(eq(coachTasks.id, task.id))
    await finalize(lease, state)
  })
}

export function retryTask(lease: TaskLease) {
  return transaction(async () => {
    const task = await lockTask(lease)
    if (task.retryCount >= 2) return false
    await append(lease, {
      kind: "state",
      payload: { state: "queued", retryCount: task.retryCount + 1 },
    })
    await getDb()
      .update(coachTasks)
      .set({
        state: "queued",
        retryCount: task.retryCount + 1,
        availableAt: sql`clock_timestamp() + ${1000 * 2 ** task.retryCount} * interval '1 millisecond'`,
        leaseOwner: null,
        leaseUntil: null,
      })
      .where(eq(coachTasks.id, task.id))
    return true
  })
}
