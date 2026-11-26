import {
  coachTaskEventSchema,
  chatDetailSchema,
  coachTaskErrorCodeSchema,
  coachTaskSnapshotSchema,
  type CoachTaskReplay,
} from "@workspace/domain/coach"
import { parseChatId, parseUserId } from "@workspace/domain/kernel"
import { and, desc, eq, gt, lte } from "drizzle-orm"
import { getDb, transaction } from "../db/context.js"
import {
  chats,
  coachTasks,
  coachUsage,
  pendingActions,
  taskCheckpoints,
  taskEvents,
  toolIntents,
} from "../db/schema.js"
import { CommandError } from "../platform/errors.js"
import type { Task } from "./task-types.js"

async function ownedTask(taskId: string, ownerId: string) {
  const [task] = await getDb()
    .select()
    .from(coachTasks)
    .where(and(eq(coachTasks.id, taskId), eq(coachTasks.ownerId, ownerId)))
    .for("share")
  const [chat] = task
    ? await getDb()
        .select({ id: chats.id })
        .from(chats)
        .where(and(eq(chats.id, task.chatId), eq(chats.userId, ownerId)))
    : []
  if (!task || !chat)
    throw new CommandError("NOT_FOUND", "Coach task not found")
  return task
}

function publicEvent(event: typeof taskEvents.$inferSelect) {
  return coachTaskEventSchema.parse({
    taskId: event.taskId,
    seq: event.seq,
    epoch: event.epoch,
    attempt: event.attempt,
    step: event.step,
    kind: event.kind,
    payload: event.payload,
    createdAt: event.createdAt.toISOString(),
  })
}

async function snapshot(task: Task) {
  const events = await getDb()
    .select()
    .from(taskEvents)
    .where(
      and(eq(taskEvents.taskId, task.id), lte(taskEvents.seq, task.nextSeq - 1))
    )
    .orderBy(taskEvents.seq)
  const { getChat } = await import("./chat/index.js")
  const detail = chatDetailSchema.parse(
    await getChat(parseUserId(task.ownerId), parseChatId(task.chatId))
  )
  const actions = await getDb()
    .select()
    .from(toolIntents)
    .where(eq(toolIntents.taskId, task.id))
    .orderBy(toolIntents.step, toolIntents.slot)
  const proposals = await getDb()
    .select({
      id: pendingActions.id,
      command: pendingActions.command,
      input: pendingActions.input,
      summary: pendingActions.summary,
      status: pendingActions.status,
    })
    .from(pendingActions)
    .where(
      and(
        eq(pendingActions.coachTaskId, task.id),
        eq(pendingActions.userId, task.ownerId)
      )
    )
    .orderBy(pendingActions.createdAt, pendingActions.id)
  const [usage] = await getDb()
    .select()
    .from(coachUsage)
    .where(eq(coachUsage.coachTaskId, task.id))
  const [checkpoint] = await getDb()
    .select({ usage: taskCheckpoints.usage })
    .from(taskCheckpoints)
    .where(eq(taskCheckpoints.taskId, task.id))
    .orderBy(desc(taskCheckpoints.version))
    .limit(1)
  if (!usage) throw new Error("Task usage missing")
  return coachTaskSnapshotSchema.parse({
    taskId: task.id,
    chatId: task.chatId,
    state: task.state,
    sourceMessageId: task.sourceMessageId,
    assistantMessageId: task.assistantMessageId,
    supersedesMessageId: task.supersedesMessageId,
    cancelRequestedAt: task.cancelRequestedAt?.toISOString() ?? null,
    errorCode: publicTaskErrorCode(task.errorCode),
    cursor: task.nextSeq - 1,
    events: events.map(publicEvent),
    messages: detail.messages,
    actions: actions.map((intent) => ({
      step: intent.step,
      slot: intent.slot,
      toolCallId: intent.providerToolUseId,
      operation: intent.operation,
      input: intent.input,
      state: intent.state,
      proposalId: intent.proposalId,
      activityId: intent.activityId,
      result: intent.publicResult,
      errorCode: intent.errorCode,
    })),
    confirmations: proposals,
    usage: {
      id: usage.id,
      finishReason: usage.finishReason,
      latencyMs: usage.latencyMs,
      inputTokens: checkpoint?.usage.inputTokens ?? 0,
      outputTokens: checkpoint?.usage.outputTokens ?? 0,
      cacheCreationInputTokens: checkpoint?.usage.cacheCreationInputTokens ?? 0,
      cacheReadInputTokens: checkpoint?.usage.cacheReadInputTokens ?? 0,
    },
  })
}

export function taskSnapshot(taskId: string, ownerId: string) {
  return transaction(async () => snapshot(await ownedTask(taskId, ownerId)))
}

export function readTaskEvents(
  taskId: string,
  ownerId: string,
  after: number
): Promise<CoachTaskReplay> {
  return transaction(async () => {
    const task = await ownedTask(taskId, ownerId)
    const high = task.nextSeq - 1
    const events = await getDb()
      .select()
      .from(taskEvents)
      .where(
        and(
          eq(taskEvents.taskId, taskId),
          gt(taskEvents.seq, after),
          lte(taskEvents.seq, high)
        )
      )
      .orderBy(taskEvents.seq)
      .limit(100)
    const [first] = await getDb()
      .select({ seq: taskEvents.seq })
      .from(taskEvents)
      .where(eq(taskEvents.taskId, taskId))
      .orderBy(taskEvents.seq)
      .limit(1)
    const reason =
      after > high
        ? "ahead"
        : after < (first?.seq ?? task.nextSeq) - 1
          ? "expired"
          : events.some((event, index) => event.seq !== after + index + 1) ||
              (!events.length && after < high)
            ? "gap"
            : null
    if (reason) return { type: "reset", reason, snapshot: await snapshot(task) }
    return {
      type: "events",
      events: events.map(publicEvent),
      cursor: events.at(-1)?.seq ?? after,
      terminal:
        ["succeeded", "failed", "cancelled"].includes(task.state) &&
        (events.at(-1)?.seq ?? after) === high,
    }
  })
}

function publicTaskErrorCode(stored: string | null) {
  if (stored === null) return null
  const known = coachTaskErrorCodeSchema.safeParse(stored)
  return known.success ? known.data : "TASK_FAILED"
}
