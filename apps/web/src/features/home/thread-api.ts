import {
  COACH_SSE_EVENTS,
  DEFAULT_THREAD_TITLE,
  parseChatId,
  type ChatCreateInput,
  type ChatDeleteInput,
  type ChatOpenInput,
  type ChatRenameInput,
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

import { apiFetch, apiStream } from "@/lib/api.ts"
import { ApiError } from "@/lib/api-error.ts"
import { runCommand, unwrapData, type SuccessBody } from "@/lib/api-envelope.ts"
import { readSseStream } from "@/lib/sse.ts"

type ChatRow = {
  id: string
  title: string
  focusKind: string | null
  focusId: string | null
  createdAt: string
  updatedAt: string
}

type ChatMessageRow = {
  id: string
  role: "person" | "coach"
  text: string
  createdAt: string
  parts?: { type: string }[]
  status?: ThreadMessage["status"]
  workedMs?: number | null
}

type ChatDetailRow = ChatRow & { messages: ChatMessageRow[] }

// The api speaks chats. The UI renders threads. This is the one place that maps between them.
function asThread(chat: ChatRow): ThreadListItem {
  return {
    id: chat.id,
    title: chat.title,
    createdAt: chat.createdAt,
    updatedAt: chat.updatedAt,
    focusDocId: chat.focusKind === "paper" ? chat.focusId : null,
  }
}

function asMessage(message: ChatMessageRow): ThreadMessage {
  const parts = (message.parts ?? []).filter(
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

function asDetail(chat: ChatDetailRow): ThreadDetail {
  return { ...asThread(chat), messages: chat.messages.map(asMessage) }
}

export const threadQueryKeys = {
  all: ["threads"] as const,
  list: () => ["threads", "list"] as const,
  detail: (id: string) => ["threads", "detail", id] as const,
  byFocusDoc: (focusDocId: string) =>
    ["threads", "focusDoc", focusDocId] as const,
}

export async function listThreads(): Promise<ThreadListItem[]> {
  const body = await apiFetch<SuccessBody<ChatRow[]>>("/api/chats")
  return unwrapData(body).map(asThread)
}

export async function getThread(id: string): Promise<ThreadDetail> {
  const body = await apiFetch<SuccessBody<ChatDetailRow>>(`/api/chats/${id}`)
  return asDetail(unwrapData(body))
}

export async function getThreadByFocusDoc(
  focusDocId: string
): Promise<ThreadListItem | null> {
  const threads = await listThreads()
  return threads.find((thread) => thread.focusDocId === focusDocId) ?? null
}

export async function createThread(input: {
  title?: string
  focusDocId?: string
}): Promise<ThreadListItem> {
  if (!input.focusDocId) {
    const chat = await runCommand<ChatRow>("chat.create", {
      ...(input.title ? { title: input.title } : {}),
    } satisfies ChatCreateInput)
    return asThread(chat)
  }
  const opened = await runCommand<ChatRow>("chat.open", {
    focus: { kind: "paper", id: input.focusDocId },
  } satisfies ChatOpenInput)
  if (!input.title || opened.title !== DEFAULT_THREAD_TITLE) {
    return asThread(opened)
  }
  const renamed = await runCommand<ChatRow>("chat.rename", {
    chatId: parseChatId(opened.id),
    title: input.title,
  } satisfies ChatRenameInput)
  return asThread(renamed)
}

export function deleteThread(chatId: string): Promise<{ id: string }> {
  return runCommand("chat.delete", {
    chatId: parseChatId(chatId),
  } satisfies ChatDeleteInput)
}

export type CoachStreamHandlers = {
  onMessageStart?: (data: CoachSseMessageStartData) => void
  onTextDelta?: (data: CoachSseTextDeltaData) => void
  onToolCall?: (data: CoachSseToolCallData) => void
  onToolResult?: (data: CoachSseToolResultData) => void
  onMessageEnd?: (data: CoachSseMessageEndData) => void
  onError?: (data: CoachSseErrorData) => void
}

export function undoReceipt(activityId: string): Promise<unknown> {
  return runCommand("activity.undo", { activityId })
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
