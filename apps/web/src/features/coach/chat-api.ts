import {
  CHAT_TITLE_MAX,
  DEFAULT_CHAT_TITLE,
  LEGACY_CHAT_TITLE,
  parseChatId,
  type ChatDetail,
  type ChatTurnEventOf,
  type ChatId,
  type ChatListItem,
  type ChatMessage,
  type CoachMode,
  type CoachContextItem,
  type CoachSelection,
  type ChatRecord,
  type ChatSummary,
  type ChatEntry,
  type ChatEntryPart,
} from "@workspace/domain"

import type { QueryClient } from "@tanstack/react-query"

import { apiFetch } from "@/lib/api.ts"
import { unwrapData, type SuccessBody } from "@/lib/api-envelope.ts"
import { queryKey, runContractCommand } from "@/lib/contract-client.ts"
import { streamChatTurn } from "@/lib/coach-stream.ts"
import { endpoints } from "@/lib/requests.ts"

// The api speaks wire chats (ChatDetail, ChatMessage). The UI renders
// ChatRecord, ChatSummary and ChatEntry. This is the one place that maps
// between them.
function asChat(chat: ChatListItem): ChatSummary {
  return {
    id: chat.id,
    title: chat.title,
    createdAt: chat.createdAt,
    updatedAt: chat.updatedAt,
    focusDocId: chat.focusKind === "paper" ? chat.focusId : null,
  }
}

function asMessage(message: ChatMessage): ChatEntry {
  const parts = message.parts.filter(
    (part): part is ChatEntryPart =>
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

function asDetail(chat: ChatDetail): ChatRecord {
  return { ...asChat(chat), messages: chat.messages.map(asMessage) }
}

export const chatListKey = () => queryKey({ query: "chat.list" })

// The id is a plain string here so a disabled query can still build its key.
export const chatDetailKey = (id: string) =>
  queryKey({ query: "chat.get", input: { chatId: id as ChatId } })

export async function listChats(): Promise<ChatSummary[]> {
  const body = await apiFetch<SuccessBody<ChatListItem[]>>(endpoints.chats)
  return unwrapData(body).map(asChat)
}

export async function getChat(id: string): Promise<ChatRecord> {
  const body = await apiFetch<SuccessBody<ChatDetail>>(endpoints.chat(id))
  return asDetail(unwrapData(body))
}

export async function getChatByFocusDoc(
  focusDocId: string
): Promise<ChatSummary | null> {
  const chats = await listChats()
  return chats.find((chat) => chat.focusDocId === focusDocId) ?? null
}

function clipTitle(title: string | undefined): string | undefined {
  const trimmed = title?.trim()
  if (!trimmed) return undefined
  return trimmed.slice(0, CHAT_TITLE_MAX).trimEnd()
}

export async function createChat(
  queryClient: QueryClient,
  input: { title?: string; focusDocId?: string }
): Promise<ChatSummary> {
  const title = clipTitle(input.title)
  if (!input.focusDocId) {
    return asChat(
      await runContractCommand(queryClient, "chat.create", {
        ...(title ? { title } : {}),
      })
    )
  }
  const opened = await runContractCommand(queryClient, "chat.open", {
    focus: { kind: "paper", id: input.focusDocId },
  })
  const openedTitle = opened.title?.trim()
  if (
    !title ||
    (openedTitle &&
      openedTitle !== DEFAULT_CHAT_TITLE &&
      openedTitle !== LEGACY_CHAT_TITLE)
  ) {
    return asChat(opened)
  }
  return asChat(
    await runContractCommand(queryClient, "chat.rename", {
      chatId: parseChatId(opened.id),
      title,
    })
  )
}

export function deleteChat(queryClient: QueryClient, chatId: string) {
  return runContractCommand(queryClient, "chat.delete", {
    chatId: parseChatId(chatId),
  })
}

export type CoachStreamHandlers = {
  onMessageStart?: (data: ChatTurnEventOf<"message-start">) => void
  onTextDelta?: (data: ChatTurnEventOf<"text-delta">) => void
  onToolCall?: (data: ChatTurnEventOf<"tool-call">) => void
  onToolResult?: (data: ChatTurnEventOf<"tool-result">) => void
  onStep?: (data: ChatTurnEventOf<"step">) => void
  onConfirm?: (data: ChatTurnEventOf<"confirm">) => void
  onUsage?: (data: ChatTurnEventOf<"usage">) => void
  onMessageEnd?: (data: ChatTurnEventOf<"message-end">) => void
  onError?: (data: ChatTurnEventOf<"error">) => void
}

type CoachStreamBody =
  | {
      text: string
      mode?: CoachMode
      focusDocId?: string | null
      selection?: CoachSelection
      context?: CoachContextItem[]
    }
  | { regenerate: true; mode?: CoachMode; focusDocId?: string | null }

function consumeCoachStream(
  queryClient: QueryClient,
  chatId: string,
  body: CoachStreamBody,
  handlers: CoachStreamHandlers,
  signal?: AbortSignal
): Promise<void> {
  return streamChatTurn({
    queryClient,
    chatId,
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
        case "step":
          handlers.onStep?.(event)
          break
        case "confirm":
          handlers.onConfirm?.(event)
          break
        case "usage":
          handlers.onUsage?.(event)
          break
        default: {
          const unexpected: never = event
          throw new Error(`Unknown Coach event: ${String(unexpected)}`)
        }
      }
    },
  })
}

export async function streamCoachTurn(
  queryClient: QueryClient,
  chatId: string,
  text: string,
  handlers: CoachStreamHandlers,
  signal?: AbortSignal,
  mode?: CoachMode,
  focusDocId?: string | null,
  selection?: CoachSelection,
  context?: CoachContextItem[]
): Promise<void> {
  await consumeCoachStream(
    queryClient,
    chatId,
    {
      text,
      ...(mode ? { mode } : {}),
      ...(focusDocId !== undefined ? { focusDocId } : {}),
      ...(selection ? { selection } : {}),
      ...(context?.length ? { context } : {}),
    },
    handlers,
    signal
  )
}

export async function streamCoachRegenerate(
  queryClient: QueryClient,
  chatId: string,
  handlers: CoachStreamHandlers,
  signal?: AbortSignal,
  mode?: CoachMode,
  focusDocId?: string | null,
  selection?: CoachSelection,
  context?: CoachContextItem[]
): Promise<void> {
  await consumeCoachStream(
    queryClient,
    chatId,
    {
      regenerate: true,
      ...(selection ? { selection } : {}),
      ...(context?.length ? { context } : {}),
      ...(mode ? { mode } : {}),
      ...(focusDocId !== undefined ? { focusDocId } : {}),
    },
    handlers,
    signal
  )
}

export function upsertChatSummary(
  chats: ChatSummary[],
  item: ChatSummary
): ChatSummary[] {
  return [item, ...chats.filter((chat) => chat.id !== item.id)]
}

export function toListItem(detail: ChatRecord): ChatSummary {
  return {
    id: detail.id,
    title: detail.title,
    createdAt: detail.createdAt,
    updatedAt: detail.updatedAt,
    focusDocId: detail.focusDocId,
  }
}
