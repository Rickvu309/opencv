import {
  catalog,
  CHAT_TITLE_MAX,
  DEFAULT_CHAT_TITLE,
  LEGACY_CHAT_TITLE,
  parseChatId,
  type ChatTurnEventOf,
  type ChatId,
  type ChatListItem,
  type ChatMessage,
  type CoachMode,
  type CoachContextItem,
  type CoachSelection,
  type ChatSummary,
  type ChatEntryPart,
  type QueryOutput,
} from "@workspace/domain"

import type { QueryClient } from "@tanstack/react-query"

import { apiFetch } from "@/lib/api.ts"
import { unwrapData, type SuccessBody } from "@/lib/api-envelope.ts"
import { catalogClient, queryKey } from "@/lib/contract-client.ts"
import { streamChatTurn } from "@/lib/coach-stream.ts"
import { withSelectedBlocks } from "@/lib/paper-selection.ts"
import { endpoints } from "@/lib/requests.ts"
import type {
  CoachChatEntry,
  CoachChatRecord,
  ChatMessageAttachment,
} from "./chat-messages.ts"

function asChat(chat: ChatListItem): ChatSummary {
  return {
    id: chat.id,
    title: chat.title,
    createdAt: chat.createdAt,
    updatedAt: chat.updatedAt,
    focusDocId: chat.focusKind === "paper" ? chat.focusId : null,
  }
}

function asMessage(message: ChatMessage): CoachChatEntry {
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

function attachmentParts(
  message: ChatMessage
): Array<{ kind: "job" | "paper" | "link" | "file"; id: string }> {
  return message.role === "person"
    ? message.parts.flatMap((part) =>
        part.type === "attachment" ? [{ kind: part.kind, id: part.id }] : []
      )
    : []
}

function linkLabel(id: string): string {
  try {
    return new URL(id).hostname || "Saved link"
  } catch {
    return "Saved link"
  }
}

async function resolveAttachments(
  messages: ChatMessage[]
): Promise<ChatMessageAttachment[][]> {
  const refs = messages.flatMap(attachmentParts)
  const jobIds = new Set(
    refs.filter((ref) => ref.kind === "job").map((ref) => ref.id)
  )
  const paperIds = new Set(
    refs.filter((ref) => ref.kind === "paper").map((ref) => ref.id)
  )
  const [jobs, papers] = await Promise.all([
    jobIds.size
      ? catalogClient.read(catalog["job.list"].name, {}).catch(() => [])
      : [],
    paperIds.size
      ? apiFetch<SuccessBody<QueryOutput<"paper.list">>>(endpoints.paper)
          .then(unwrapData)
          .catch(() => [])
      : [],
  ])
  const jobLabels = new Map<string, string>(
    jobs.map((job) => [
      job.id,
      `${job.title}${job.company ? ` at ${job.company}` : ""}`,
    ])
  )
  const paperLabels = new Map<string, string>(
    papers.map((paper) => [paper.id, paper.name])
  )
  return messages.map((message) =>
    attachmentParts(message).map((ref) => ({
      ...ref,
      label:
        ref.kind === "link"
          ? linkLabel(ref.id)
          : ref.kind === "job"
            ? (jobLabels.get(ref.id) ?? "Saved job")
            : ref.kind === "paper"
              ? (paperLabels.get(ref.id) ?? "Saved document")
              : "Saved file",
    }))
  )
}

export const chatListKey = () => queryKey({ query: catalog["chat.list"].name })

export const chatDetailKey = (id: string) =>
  queryKey({ query: catalog["chat.get"].name, input: { chatId: id as ChatId } })

export async function listChats(): Promise<ChatSummary[]> {
  const chats = await catalogClient.read(catalog["chat.list"].name, {})
  return chats.map(asChat)
}

export async function getChat(id: string): Promise<CoachChatRecord> {
  const chat = await catalogClient.read(catalog["chat.get"].name, {
    chatId: parseChatId(id),
  })
  const attachments = await resolveAttachments(chat.messages)
  return {
    ...asChat(chat),
    activeTaskId: chat.activeTaskId,
    messages: chat.messages
      .map((message, index) => ({
        ...asMessage(message),
        ...(attachments[index]?.length
          ? { attachments: attachments[index] }
          : {}),
      }))
      .filter((message) => message.id !== chat.activeTaskId),
  }
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

export async function startChat(queryClient: QueryClient, title?: string) {
  const chat = await catalogClient.run(queryClient, "chat.create", {
    ...(title ? { title } : {}),
  })
  if ("pending" in chat) throw new Error("The chat did not start")
  return chat
}

export async function createChat(
  queryClient: QueryClient,
  input: { title?: string; focusDocId?: string }
): Promise<ChatSummary> {
  const title = clipTitle(input.title)
  if (!input.focusDocId) {
    return asChat(await startChat(queryClient, title))
  }
  const opened = await catalogClient.run(queryClient, "chat.open", {
    focus: { kind: "paper", id: input.focusDocId },
  })
  if ("pending" in opened) throw new Error("The chat did not open")
  const openedTitle = opened.title?.trim()
  if (
    !title ||
    (openedTitle &&
      openedTitle !== DEFAULT_CHAT_TITLE &&
      openedTitle !== LEGACY_CHAT_TITLE)
  ) {
    return asChat(opened)
  }
  const renamed = await catalogClient.run(queryClient, "chat.rename", {
    chatId: parseChatId(opened.id),
    title,
  })
  if ("pending" in renamed) throw new Error("The chat was not renamed")
  return asChat(renamed)
}

export function deleteChat(queryClient: QueryClient, chatId: string) {
  return catalogClient.run(queryClient, "chat.delete", {
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
        case "notice":
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
      ...(withSelectedBlocks(context)?.length
        ? { context: withSelectedBlocks(context) }
        : {}),
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
      ...(withSelectedBlocks(context)?.length
        ? { context: withSelectedBlocks(context) }
        : {}),
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

export function toListItem(detail: CoachChatRecord): ChatSummary {
  return {
    id: detail.id,
    title: detail.title,
    createdAt: detail.createdAt,
    updatedAt: detail.updatedAt,
    focusDocId: detail.focusDocId,
  }
}
