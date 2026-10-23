import {
  COACH_SSE_EVENTS,
  THREAD_COMMANDS,
  type CoachFeedbackInput,
  type CoachMode,
  type CoachSelection,
  type CoachSseErrorData,
  type CoachSseMessageEndData,
  type CoachSseMessageStartData,
  type CoachSseTextDeltaData,
  type CoachSseToolCallData,
  type CoachSseToolResultData,
  type CoachReverseResult,
  type CoachUsageRating,
  type ThreadDeleted,
  type ThreadDetail,
  type ThreadListItem,
  type ThreadsCreateInput,
  type ThreadsDeleteInput,
  type ThreadsPostMessageInput,
} from "@workspace/domain"

import { apiFetch, apiStream } from "@/lib/api.ts"
import { ApiError } from "@/lib/api-error.ts"
import { runCommand, unwrapData, type SuccessBody } from "@/lib/api-envelope.ts"
import { readSseStream } from "@/lib/sse.ts"

export const threadQueryKeys = {
  all: ["threads"] as const,
  list: () => ["threads", "list"] as const,
  detail: (id: string) => ["threads", "detail", id] as const,
  byFocusDoc: (focusDocId: string) =>
    ["threads", "focusDoc", focusDocId] as const,
}

export async function listThreads(): Promise<ThreadListItem[]> {
  const body = await apiFetch<SuccessBody<ThreadListItem[]>>("/api/threads")
  return unwrapData(body)
}

export async function getThread(id: string): Promise<ThreadDetail> {
  const body = await apiFetch<SuccessBody<ThreadDetail>>(`/api/threads/${id}`)
  return unwrapData(body)
}

export async function getThreadByFocusDoc(
  focusDocId: string
): Promise<ThreadListItem | null> {
  const params = new URLSearchParams({ focusDocId })
  const body = await apiFetch<SuccessBody<ThreadListItem | null>>(
    `/api/threads?${params.toString()}`
  )
  return unwrapData(body)
}

export function createThread(
  input: ThreadsCreateInput = {}
): Promise<ThreadListItem> {
  return runCommand<ThreadListItem>(THREAD_COMMANDS.create, input)
}

export function postThreadMessage(
  input: ThreadsPostMessageInput
): Promise<ThreadDetail> {
  return runCommand<ThreadDetail>(THREAD_COMMANDS.postMessage, input)
}

export function deleteThread(
  input: ThreadsDeleteInput
): Promise<ThreadDeleted> {
  return runCommand<ThreadDeleted>(THREAD_COMMANDS.delete, input)
}

export type CoachStreamHandlers = {
  onMessageStart?: (data: CoachSseMessageStartData) => void
  onTextDelta?: (data: CoachSseTextDeltaData) => void
  onToolCall?: (data: CoachSseToolCallData) => void
  onToolResult?: (data: CoachSseToolResultData) => void
  onMessageEnd?: (data: CoachSseMessageEndData) => void
  onError?: (data: CoachSseErrorData) => void
}

export async function reverseCoachReceipt(
  threadId: string,
  messageId: string,
  toolCallId: string
): Promise<CoachReverseResult> {
  const body = await apiFetch<SuccessBody<CoachReverseResult>>(
    `/api/threads/${threadId}/messages/${messageId}/reverse`,
    {
      method: "POST",
      body: JSON.stringify({ toolCallId }),
    }
  )
  return unwrapData(body)
}

export async function rateCoachMessage(
  threadId: string,
  messageId: string,
  rating: CoachUsageRating
): Promise<{ messageId: string; rating: CoachUsageRating }> {
  const body = await apiFetch<
    SuccessBody<{ messageId: string; rating: CoachUsageRating }>
  >(`/api/threads/${threadId}/messages/${messageId}/feedback`, {
    method: "POST",
    body: JSON.stringify({ rating } satisfies CoachFeedbackInput),
  })
  return unwrapData(body)
}

type CoachStreamBody =
  | {
      text: string
      mode?: CoachMode
      focusDocId?: string | null
      selection?: CoachSelection
    }
  | { regenerate: true; mode?: CoachMode; focusDocId?: string | null }

async function consumeCoachStream(
  threadId: string,
  body: CoachStreamBody,
  handlers: CoachStreamHandlers,
  signal?: AbortSignal
): Promise<void> {
  const res = await apiStream(`/api/threads/${threadId}/coach`, {
    method: "POST",
    body: JSON.stringify(body),
    signal,
  })

  if (!res.body) {
    throw new ApiError(502, "REQUEST_FAILED", "Coach stream was empty")
  }

  for await (const event of readSseStream(res.body, { signal })) {
    switch (event.event) {
      case COACH_SSE_EVENTS.messageStart:
        handlers.onMessageStart?.(event.data as CoachSseMessageStartData)
        break
      case COACH_SSE_EVENTS.textDelta:
        handlers.onTextDelta?.(event.data as CoachSseTextDeltaData)
        break
      case COACH_SSE_EVENTS.toolCall:
        handlers.onToolCall?.(event.data as CoachSseToolCallData)
        break
      case COACH_SSE_EVENTS.toolResult:
        handlers.onToolResult?.(event.data as CoachSseToolResultData)
        break
      case COACH_SSE_EVENTS.messageEnd:
        handlers.onMessageEnd?.(event.data as CoachSseMessageEndData)
        break
      case COACH_SSE_EVENTS.error:
        handlers.onError?.(event.data as CoachSseErrorData)
        break
      default:
        break
    }
  }
}

export async function streamCoachTurn(
  threadId: string,
  text: string,
  handlers: CoachStreamHandlers,
  signal?: AbortSignal,
  mode?: CoachMode,
  focusDocId?: string | null,
  selection?: CoachSelection
): Promise<void> {
  await consumeCoachStream(
    threadId,
    {
      text,
      ...(mode ? { mode } : {}),
      ...(focusDocId !== undefined ? { focusDocId } : {}),
      ...(selection ? { selection } : {}),
    },
    handlers,
    signal
  )
}

export async function streamCoachRegenerate(
  threadId: string,
  handlers: CoachStreamHandlers,
  signal?: AbortSignal,
  mode?: CoachMode,
  focusDocId?: string | null
): Promise<void> {
  await consumeCoachStream(
    threadId,
    {
      regenerate: true,
      ...(mode ? { mode } : {}),
      ...(focusDocId !== undefined ? { focusDocId } : {}),
    },
    handlers,
    signal
  )
}

export function upsertThreadListItem(
  threads: ThreadListItem[],
  item: ThreadListItem
): ThreadListItem[] {
  return [item, ...threads.filter((thread) => thread.id !== item.id)]
}

export function toListItem(detail: ThreadDetail): ThreadListItem {
  return {
    id: detail.id,
    title: detail.title,
    createdAt: detail.createdAt,
    updatedAt: detail.updatedAt,
    focusDocId: detail.focusDocId,
  }
}
