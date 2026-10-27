import {
  COACH_SSE_EVENTS,
  DEFAULT_THREAD_TITLE,
  parseChatId,
  type ChatDetail,
  type ChatId,
  type ChatListItem,
  type ChatMessage,
  type CoachMode,
  type CoachSelection,
  type CoachSseErrorData,
  type CoachSseMessageEndData,
  type CoachSseMessageStartData,
  type CoachSseTextDeltaData,
  type CoachSseToolCallData,
  type CoachSseToolResultData,
  type ThreadDetail,
  type ThreadListItem,
  type ThreadMessage,
  type ThreadMessagePart,
} from "@workspace/domain"

import type { QueryClient } from "@tanstack/react-query"

import { apiFetch, apiStream } from "@/lib/api.ts"
import { ApiError } from "@/lib/api-error.ts"
import { unwrapData, type SuccessBody } from "@/lib/api-envelope.ts"
import { queryKey, runContractCommand } from "@/lib/contract-client.ts"
import { readSseStream } from "@/lib/sse.ts"

// The api speaks chats. The UI renders threads. This is the one place that maps between them.
function asThread(chat: ChatListItem): ThreadListItem {
  return {
    id: chat.id,
    title: chat.title,
    createdAt: chat.createdAt,
    updatedAt: chat.updatedAt,
    focusDocId: chat.focusKind === "paper" ? chat.focusId : null,
  }
}

function asMessage(message: ChatMessage): ThreadMessage {
  const parts = message.parts.filter(
    (part): part is ThreadMessagePart =>
      part.type === "text" || part.type === "tool"
  )
  return {
    id: message.id,
    role: message.role === "person" ? "user" : "coach",
    text: message.text,
    createdAt: message.createdAt,
    ...(parts.length > 0 ? { parts } : {}),
    ...(message.status ? { status: message.status } : {}),
    ...(message.workedMs != null ? { workedMs: message.workedMs } : {}),
  }
}

function asDetail(chat: ChatDetail): ThreadDetail {
  return { ...asThread(chat), messages: chat.messages.map(asMessage) }
}

export const chatListKey = () => queryKey({ query: "chat.list" })

// The id is a plain string here so a disabled query can still build its key.
export const chatDetailKey = (id: string) =>
  queryKey({ query: "chat.get", input: { chatId: id as ChatId } })

export async function listThreads(): Promise<ThreadListItem[]> {
  const body = await apiFetch<SuccessBody<ChatListItem[]>>("/api/chats")
  return unwrapData(body).map(asThread)
}

export async function getThread(id: string): Promise<ThreadDetail> {
  const body = await apiFetch<SuccessBody<ChatDetail>>(`/api/chats/${id}`)
  return asDetail(unwrapData(body))
}

export async function getThreadByFocusDoc(
  focusDocId: string
): Promise<ThreadListItem | null> {
  const threads = await listThreads()
  return threads.find((thread) => thread.focusDocId === focusDocId) ?? null
}

export async function createThread(
  queryClient: QueryClient,
  input: { title?: string; focusDocId?: string }
): Promise<ThreadListItem> {
  if (!input.focusDocId) {
    return asThread(
      await runContractCommand(queryClient, "chat.create", {
        ...(input.title ? { title: input.title } : {}),
      })
    )
  }
  const opened = await runContractCommand(queryClient, "chat.open", {
    focus: { kind: "paper", id: input.focusDocId },
  })
  if (!input.title || opened.title !== DEFAULT_THREAD_TITLE) {
    return asThread(opened)
  }
  return asThread(
    await runContractCommand(queryClient, "chat.rename", {
      chatId: parseChatId(opened.id),
      title: input.title,
    })
  )
}

export function deleteThread(queryClient: QueryClient, chatId: string) {
  return runContractCommand(queryClient, "chat.delete", {
    chatId: parseChatId(chatId),
  })
}

export type CoachStreamHandlers = {
  onMessageStart?: (data: CoachSseMessageStartData) => void
  onTextDelta?: (data: CoachSseTextDeltaData) => void
  onToolCall?: (data: CoachSseToolCallData) => void
  onToolResult?: (data: CoachSseToolResultData) => void
  onMessageEnd?: (data: CoachSseMessageEndData) => void
  onError?: (data: CoachSseErrorData) => void
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
  const res = await apiStream(`/api/chats/${threadId}/turns`, {
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
