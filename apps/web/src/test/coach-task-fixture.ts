import { coachTaskSnapshotSchema, parseChatId } from "@workspace/domain"
import type { TaskEvent, TaskSnapshot } from "@/lib/coach-task-state.ts"

export const TASK = "01900000-0000-7000-8000-000000000001"
export const CHAT = parseChatId("01900000-0000-7000-8000-000000000002")
export function taskStarted(taskId: string = TASK) {
  return {
    taskId,
    chatId: CHAT,
    receipt: {
      taskId,
      chatId: CHAT,
      acceptedAt: "2026-01-01T00:00:00.000Z",
    },
  }
}

export function taskSnapshot(patch: Partial<TaskSnapshot> = {}): TaskSnapshot {
  return coachTaskSnapshotSchema.parse({
    taskId: TASK,
    chatId: CHAT,
    state: "running",
    sourceMessageId: null,
    assistantMessageId: null,
    supersedesMessageId: null,
    cancelRequestedAt: null,
    errorCode: null,
    cursor: -1,
    events: [],
    messages: [],
    actions: [],
    confirmations: [],
    usage: {
      id: TASK,
      finishReason: null,
      latencyMs: null,
      inputTokens: 0,
      outputTokens: 0,
    },
    ...patch,
  })
}
export function taskEvent(
  seq: number,
  text: string,
  patch: Partial<TaskEvent> = {}
): TaskEvent {
  return {
    taskId: TASK,
    seq,
    epoch: 1,
    attempt: 1,
    step: 0,
    kind: "draft",
    payload: { text },
    createdAt: "2026-11-06T00:00:00.000Z",
    ...patch,
  }
}
