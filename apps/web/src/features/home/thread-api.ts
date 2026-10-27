import {
  DEFAULT_THREAD_TITLE,
  parseChatId,
  type ChatDetail,
  type ChatTurnEventOf,
  type ChatId,
  type ChatListItem,
  type ChatMessage,
  type CoachMode,
  type CoachSelection,
  type ThreadDetail,
  type ThreadListItem,
  type ThreadMessage,
  type ThreadMessagePart,
} from "@workspace/domain"

import type { QueryClient } from "@tanstack/react-query"

import { apiFetch } from "@/lib/api.ts"
import { unwrapData, type SuccessBody } from "@/lib/api-envelope.ts"
import { queryKey, runContractCommand } from "@/lib/contract-client.ts"
import { streamChatTurn } from "@/lib/coach-stream.ts"

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
  onMessageStart?: (data: ChatTurnEventOf<"message-start">) => void
  onTextDelta?: (data: ChatTurnEventOf<"text-delta">) => void
  onToolCall?: (data: ChatTurnEventOf<"tool-call">) => void
  onToolResult?: (data: ChatTurnEventOf<"tool-result">) => void
  onMessageEnd?: (data: ChatTurnEventOf<"message-end">) => void
  onError?: (data: ChatTurnEventOf<"error">) => void
}

type CoachStreamBody =
  | {
      text: string
      mode?: CoachMode
      focusDocId?: string | null
      selection?: CoachSelection
    }
  | { regenerate: true; mode?: CoachMode; focusDocId?: string | null }

function consumeCoachStream(
  queryClient: QueryClient,
  threadId: string,
  body: CoachStreamBody,
  handlers: CoachStreamHandlers,
  signal?: AbortSignal
): Promise<void> {
  return streamChatTurn({
    queryClient,
    chatId: threadId,
    body,
    signal,
    onEvent(event) {
      switch (event.type) {
        case "message-start":
          handlers.onMessageStart?.(event)
          break
        case "text-delta":
          handlers.onTextDelta?.(event)
          break
        case "tool-call":
          handlers.onToolCall?.(event)
          break
        case "tool-result":
          handlers.onToolResult?.(event)
          break
        case "message-end":
          handlers.onMessageEnd?.(event)
          break
        case "error":
          handlers.onError?.(event)
          break
        default:
          break
      }
    },
  })
}

export async function streamCoachTurn(
  queryClient: QueryClient,
  threadId: string,
  text: string,
  handlers: CoachStreamHandlers,
  signal?: AbortSignal,
  mode?: CoachMode,
  focusDocId?: string | null,
  selection?: CoachSelection
): Promise<void> {
  await consumeCoachStream(
    queryClient,
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
  queryClient: QueryClient,
  threadId: string,
  handlers: CoachStreamHandlers,
  signal?: AbortSignal,
  mode?: CoachMode,
  focusDocId?: string | null
): Promise<void> {
  await consumeCoachStream(
    queryClient,
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
