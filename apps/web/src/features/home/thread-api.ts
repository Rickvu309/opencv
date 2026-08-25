import {
  COACH_SSE_EVENTS,
  THREAD_COMMANDS,
  type CoachSseErrorData,
  type CoachSseMessageEndData,
  type CoachSseMessageStartData,
  type CoachSseTextDeltaData,
  type CoachSseToolCallData,
  type CoachSseToolResultData,
  type ThreadDetail,
  type ThreadListItem,
  type ThreadsCreateInput,
  type ThreadsPostMessageInput,
} from "@workspace/domain"

import { apiFetch, apiStream } from "@/lib/api.ts"
import { ApiError } from "@/lib/api-error.ts"
import { readSseStream } from "@/lib/sse.ts"

export const threadQueryKeys = {
  all: ["threads"] as const,
  list: () => ["threads", "list"] as const,
  detail: (id: string) => ["threads", "detail", id] as const,
}

type SuccessBody<T> = {
  ok: true
  data: T
}

function unwrapData<T>(body: SuccessBody<T>): T {
  return body.data
}

async function runCommand<T>(name: string, input: unknown): Promise<T> {
  const body = await apiFetch<SuccessBody<T>>(`/api/commands/${name}`, {
    method: "POST",
    body: JSON.stringify(input),
  })
  return unwrapData(body)
}

export async function listThreads(): Promise<ThreadListItem[]> {
  const body = await apiFetch<SuccessBody<ThreadListItem[]>>("/api/threads")
  return unwrapData(body)
}

export async function getThread(id: string): Promise<ThreadDetail> {
  const body = await apiFetch<SuccessBody<ThreadDetail>>(`/api/threads/${id}`)
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

export type CoachStreamHandlers = {
  onMessageStart?: (data: CoachSseMessageStartData) => void
  onTextDelta?: (data: CoachSseTextDeltaData) => void
  onToolCall?: (data: CoachSseToolCallData) => void
  onToolResult?: (data: CoachSseToolResultData) => void
  onMessageEnd?: (data: CoachSseMessageEndData) => void
  onError?: (data: CoachSseErrorData) => void
}

export async function streamCoachTurn(
  threadId: string,
  text: string,
  handlers: CoachStreamHandlers,
  signal?: AbortSignal
): Promise<void> {
  const res = await apiStream(`/api/threads/${threadId}/coach`, {
    method: "POST",
    body: JSON.stringify({ text }),
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
  }
}
