import { catalog, parseChatId, chatIdSchema } from "@workspace/domain/kernel"
import {
  paperImportResponseSchema,
  letterAttachmentContextSchema,
} from "@workspace/domain/paper-doc"
import type { QueryClient } from "@tanstack/react-query"
import type { ChatDetail, ChatToolName } from "@workspace/domain/coach"

import { ApiError, isErrorEnvelope } from "@/lib/api.ts"
import { catalogClient } from "@/lib/contract-client.ts"
import { streamChatTurn } from "@/lib/coach-stream.ts"
import { tailCoachTask } from "@/lib/coach-task-client.ts"
import type { CoachTaskState } from "@/lib/coach-task-state.ts"
import { endpoints, fetchBinary } from "@/lib/requests.ts"

export class PaperLimitError extends Error {
  readonly resetsAt: string | null

  constructor(message: string, resetsAt: string | null) {
    super(message)
    this.name = "PaperLimitError"
    this.resetsAt = resetsAt
  }
}

export const CV_PHOTO_MAX_BYTES = 2_000_000
export const CV_PHOTO_SIZE_REJECTION = "Photo must be 2 MB or smaller."
export const CV_PHOTO_TYPE_REJECTION = "Upload an image."

export function cvPhotoRejection(file: File) {
  if (!file.type.startsWith("image/")) return CV_PHOTO_TYPE_REJECTION
  if (file.size > CV_PHOTO_MAX_BYTES) return CV_PHOTO_SIZE_REJECTION
  return null
}

export async function extractLetterAttachment(
  file: File,
  signal?: AbortSignal
) {
  const body = new FormData()
  body.set("file", file)
  const response = await fetchBinary(endpoints.letterAttachment, {
    method: "POST",
    credentials: "include",
    body,
    signal,
  })
  const payload: unknown = await response.json()
  if (!response.ok) {
    throw new ApiError(
      response.status,
      "REQUEST_FAILED",
      isErrorEnvelope(payload)
        ? payload.error.message
        : "Could not read that file. Try again."
    )
  }
  const data =
    payload && typeof payload === "object" && "data" in payload
      ? payload.data
      : null
  return letterAttachmentContextSchema.parse(data)
}

export async function importPaperFile(file: File, signal?: AbortSignal) {
  const body = new FormData()
  body.set("file", file)
  const res = await fetchBinary(endpoints.paperImport, {
    method: "POST",
    credentials: "include",
    body,
    signal,
  })
  if (!res.ok) {
    const payload = (await res.json().catch(() => null)) as {
      error?: { code?: string; message?: string }
    } | null
    throw new ApiError(
      res.status,
      payload?.error?.code ?? "REQUEST_FAILED",
      payload?.error?.message ?? "Could not import that file. Try it again."
    )
  }
  const reply = paperImportResponseSchema.parse(await res.json())
  return { ...reply.data, notice: reply.data.notice ?? null }
}

export async function importPaperLink(
  link: string,
  signal?: AbortSignal
): Promise<never> {
  const res = await fetchBinary(endpoints.paperImport, {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ link }),
    signal,
  })
  const payload = (await res.json().catch(() => null)) as {
    error?: { message?: string }
  } | null
  throw new ApiError(
    res.ok ? 422 : res.status,
    "LINK_UNREADABLE",
    payload?.error?.message ?? "Could not import that file. Try it again."
  )
}

export async function stopPaperChat(
  queryClient: QueryClient,
  chatId: string
): Promise<void> {
  const parsed = chatIdSchema.safeParse(chatId)
  if (!parsed.success) return
  await catalogClient.run(
    queryClient,
    "coach.stop",
    { chatId: parsed.data },
    { refresh: false }
  )
}

export async function streamPaperTurn(input: {
  queryClient: QueryClient
  chatId: string
  text: string
  focusDocId?: string
  context?: { kind: "paper" | "job" | "link" | "file"; id: string }[]
  textOnly?: true
  signal?: AbortSignal
  onText: (delta: string) => void
  onToolResult?: (tool: ChatToolName) => void
  onWaiting?: () => void
}): Promise<PaperTurnEnd> {
  const turn: { end: PaperTurnEnd } = { end: "finished" }
  const tail = new AbortController()
  const forward = () => tail.abort(input.signal?.reason)
  input.signal?.addEventListener("abort", forward, { once: true })
  if (input.signal?.aborted) forward()
  const followFromHere = () => {
    turn.end = "continuing"
    tail.abort()
  }
  try {
    await streamChatTurn({
      queryClient: input.queryClient,
      chatId: input.chatId,
      body: {
        text: input.text,
        ...(input.focusDocId ? { focusDocId: input.focusDocId } : {}),
        ...(input.context ? { context: input.context } : {}),
        ...(input.textOnly ? { textOnly: true } : {}),
      },
      signal: tail.signal,
      onEvent(event) {
        if (tail.signal.aborted) return
        if (event.type === "text-delta") input.onText(event.text)
        if (event.type === "tool-result") input.onToolResult?.(event.name)
        if (
          event.type === "tool-result" &&
          event.pendingActionId &&
          input.onWaiting
        ) {
          input.onWaiting()
          followFromHere()
        }
        if (event.type === "notice") turn.end = "continuing"
        if (event.type === "error") {
          throw new ApiError(502, "REQUEST_FAILED", event.message)
        }
      },
    })
    return turn.end
  } catch (error) {
    if (turn.end === "continuing" && !input.signal?.aborted) return turn.end
    if (error instanceof ApiError && error.status === 429) {
      const usage = await catalogClient
        .read(catalog["coach.usage"].name, {})
        .catch(() => null)
      throw new PaperLimitError(error.message, usage?.day.resetsAt ?? null)
    }
    throw error
  } finally {
    input.signal?.removeEventListener("abort", forward)
  }
}

export type PaperTurnEnd = "finished" | "continuing"

export const LETTER_UNFINISHED =
  "Coach could not finish your letter. Try again."
export const LETTER_OFFLINE =
  "You went offline while Coach was writing your letter. Try again."

function savedReply(
  messages: ChatDetail["messages"],
  messageId: string | null
): string {
  const reply = messageId
    ? messages.find((message) => message.id === messageId)
    : messages.findLast((message) => message.role === "coach")
  if (!reply || reply.role !== "coach" || reply.status !== "final")
    throw new ApiError(502, "REQUEST_FAILED", LETTER_UNFINISHED)
  return reply.text
}

export async function followPaperTurn(input: {
  queryClient: QueryClient
  chatId: string
  signal: AbortSignal
  onText: (text: string) => void
  onWaiting: (waiting: boolean) => void
}): Promise<string> {
  const chat = await catalogClient.read(
    catalog["chat.get"].name,
    { chatId: parseChatId(input.chatId) },
    { signal: input.signal }
  )
  const taskId = chat.activeTaskId
  if (!taskId) return savedReply(chat.messages, null)
  const follow = new AbortController()
  let offline = false
  const seen: { state: CoachTaskState | null } = { state: null }
  const stop = () => follow.abort()
  const goOffline = () => {
    offline = true
    follow.abort()
  }
  input.signal.addEventListener("abort", stop, { once: true })
  window.addEventListener("offline", goOffline)
  try {
    await tailCoachTask({
      queryClient: input.queryClient,
      taskId,
      signal: follow.signal,
      onState(state) {
        if (state.reconnecting && !navigator.onLine) return goOffline()
        seen.state = state
        input.onWaiting(state.snapshot.state === "waitingApproval")
        input.onText(state.draft)
      },
    })
  } finally {
    input.signal.removeEventListener("abort", stop)
    window.removeEventListener("offline", goOffline)
  }
  if (input.signal.aborted) throw new DOMException("Stopped", "AbortError")
  if (offline) throw new ApiError(0, "NETWORK_ERROR", LETTER_OFFLINE)
  const finished = seen.state
  if (!finished || finished.snapshot.state !== "succeeded")
    throw new ApiError(502, "REQUEST_FAILED", LETTER_UNFINISHED)
  return finished.snapshot.assistantMessageId
    ? savedReply(
        finished.snapshot.messages,
        finished.snapshot.assistantMessageId
      )
    : finished.draft
}

export async function latestActivityId(
  subjectId: string
): Promise<string | null> {
  const rows = await catalogClient.read(catalog["activity.list"].name, {
    subjectId,
  })
  return rows[0]?.id ?? null
}
