import { useSyncExternalStore } from "react"

import { ApiError } from "@/lib/api-error.ts"
import { ERROR_CODES } from "@workspace/domain"
import { isAbortError, readSseStream } from "@/lib/sse.ts"
import { coachSendErrorMessage } from "@/features/home/coach-error.ts"

import {
  getChat,
  messageFromServer,
  stopChat,
  streamTurn,
} from "./coach-api.ts"
import type {
  CoachAttachment,
  CoachUiMessage,
  CoachUiPart,
} from "./coach-model.ts"

export type LiveChat = {
  messages: CoachUiMessage[]
  streaming: boolean
  error: string | null
  loaded: boolean
  title: string
  focusKind: string | null
  focusId: string | null
}

const EMPTY: LiveChat = {
  messages: [],
  streaming: false,
  error: null,
  loaded: false,
  title: "New chat",
  focusKind: null,
  focusId: null,
}

const cache = new Map<string, LiveChat>()
const controllers = new Map<string, AbortController>()
const listeners = new Set<() => void>()

function emit() {
  for (const listener of listeners) listener()
}

function write(chatId: string, next: LiveChat) {
  cache.set(chatId, next)
  emit()
}

export function subscribeCoachLive(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function readCoachLive(chatId: string | null): LiveChat {
  if (!chatId) return EMPTY
  return cache.get(chatId) ?? EMPTY
}

export function useCoachLive(chatId: string | null) {
  return useSyncExternalStore(
    subscribeCoachLive,
    () => readCoachLive(chatId),
    () => readCoachLive(chatId)
  )
}

export function resetCoachLive() {
  for (const controller of controllers.values()) controller.abort()
  controllers.clear()
  cache.clear()
  emit()
}

export function rememberFocus(
  chatId: string,
  focusKind: string | null,
  focusId: string | null
) {
  const current = cache.get(chatId) ?? { ...EMPTY, loaded: true }
  write(chatId, { ...current, focusKind, focusId, loaded: true })
}

export async function loadCoachChat(chatId: string) {
  const current = cache.get(chatId)
  if (current?.streaming || (current?.loaded && current.messages.length > 0)) {
    return
  }
  try {
    const chat = await getChat(chatId)
    const latest = cache.get(chatId)
    if (latest?.streaming || (latest?.messages.length ?? 0) > 0) return
    write(chatId, {
      messages: (chat.messages ?? []).map(messageFromServer),
      streaming: false,
      error: null,
      loaded: true,
      title: chat.title?.trim() || "New chat",
      focusKind: chat.focusKind ?? null,
      focusId: chat.focusId ?? null,
    })
  } catch {
    const latest = cache.get(chatId)
    if (latest?.streaming || latest?.loaded) return
    write(chatId, { ...EMPTY, loaded: true })
  }
}

/** The server names a chat after the turn. Keep the messages already on screen. */
export async function refreshCoachMeta(chatId: string) {
  try {
    const chat = await getChat(chatId)
    const latest = cache.get(chatId)
    if (!latest) return
    const title = chat.title?.trim() || latest.title
    const focusKind = chat.focusKind ?? null
    const focusId = chat.focusId ?? null
    if (
      title === latest.title &&
      focusKind === latest.focusKind &&
      focusId === latest.focusId
    ) {
      return
    }
    write(chatId, { ...latest, title, focusKind, focusId })
  } catch {
    // The heading keeps the title already on screen.
  }
}

function textPart(parts: CoachUiPart[]) {
  return parts.find((part) => part.kind === "text")
}

function applyEvent(message: CoachUiMessage, event: string, data: unknown) {
  const record =
    data && typeof data === "object" ? (data as Record<string, unknown>) : {}
  if (event === "message-start") {
    message.startedAt = Date.now()
    return
  }
  if (event === "text-delta" && typeof record.text === "string") {
    const existing = textPart(message.parts)
    if (existing && existing.kind === "text") existing.text += record.text
    else message.parts.push({ kind: "text", text: record.text })
    return
  }
  if (event === "step" && typeof record.label === "string") {
    message.parts.push({ kind: "step", label: record.label })
    return
  }
  if (event === "confirm" && typeof record.pendingActionId === "string") {
    message.parts.push({
      kind: "confirm",
      pendingActionId: record.pendingActionId,
      command: typeof record.command === "string" ? record.command : "",
      summary: typeof record.summary === "string" ? record.summary : "",
    })
    message.status = "awaiting"
    return
  }
  if (event === "tool-result") {
    const activityId =
      typeof record.activityId === "string" ? record.activityId : undefined
    const summary = typeof record.summary === "string" ? record.summary : ""
    const name = typeof record.name === "string" ? record.name : "Document"
    const changes =
      typeof record.changes === "number" ? record.changes : undefined
    if (activityId || changes != null) {
      message.parts.push({
        kind: "result",
        ...(activityId ? { activityId } : {}),
        name,
        summary,
        ...(changes != null ? { changes } : {}),
        ...(typeof record.docId === "string" ? { docId: record.docId } : {}),
      })
    } else if (summary) {
      message.parts.push({ kind: "step", label: summary })
    }
    return
  }
  if (event === "message-end" && typeof record.workedMs === "number") {
    message.workedMs = record.workedMs
  }
  if (event === "error" && typeof record.message === "string") {
    message.status = "error"
  }
}

function liveErrorText(message: string) {
  if (/^[A-Z0-9_]+$/.test(message.trim())) {
    return "Something went wrong sending that. Try again."
  }
  return message
}

export async function sendCoachTurn(input: {
  chatId: string
  text: string
  attachments: CoachAttachment[]
}): Promise<{ restoreDraft: boolean; limited: boolean; error: string | null }> {
  const current = cache.get(input.chatId) ?? { ...EMPTY, loaded: true }
  const person: CoachUiMessage = {
    id: crypto.randomUUID(),
    role: "person",
    parts: [{ kind: "text", text: input.text }],
    status: "final",
  }
  const coach: CoachUiMessage = {
    id: crypto.randomUUID(),
    role: "coach",
    parts: [],
    status: "final",
    startedAt: Date.now(),
  }
  write(input.chatId, {
    ...current,
    loaded: true,
    streaming: true,
    error: null,
    messages: [...current.messages, person, coach],
  })

  const controller = new AbortController()
  controllers.set(input.chatId, controller)
  let started = false

  const fail = (
    error: string | null,
    restoreDraft: boolean,
    limited = false
  ) => {
    const latest = cache.get(input.chatId) ?? current
    const stopped =
      controller.signal.aborted ||
      latest.messages.some(
        (item) => item.id === coach.id && item.status === "aborted"
      )
    if (stopped) {
      markStopped(input.chatId)
      return { restoreDraft: false, limited: false, error: null }
    }
    const messages = restoreDraft
      ? latest.messages.filter(
          (message) => message.id !== person.id && message.id !== coach.id
        )
      : latest.messages
    write(input.chatId, {
      ...latest,
      messages,
      streaming: false,
      error,
    })
    return { restoreDraft, limited, error }
  }

  try {
    const response = await streamTurn(
      input.chatId,
      {
        text: input.text,
        ...(input.attachments.length > 0
          ? { attachments: input.attachments }
          : {}),
      },
      controller.signal
    )
    if (!response.body) throw new Error("Empty coach stream")
    for await (const event of readSseStream(response.body, {
      signal: controller.signal,
    })) {
      if (controller.signal.aborted) break
      started = true
      const latest = cache.get(input.chatId)
      const message = latest?.messages.find((item) => item.id === coach.id)
      if (!latest || !message) break
      applyEvent(message, event.event, event.data)
      if (event.event === "error") {
        const record = event.data as { message?: string }
        write(input.chatId, {
          ...latest,
          messages: latest.messages.map((item) =>
            item.id === message.id ? { ...message } : item
          ),
          error: liveErrorText(record.message ?? ""),
          streaming: false,
        })
        return { restoreDraft: false, limited: false, error: null }
      }
      write(input.chatId, {
        ...latest,
        messages: latest.messages.map((item) =>
          item.id === message.id
            ? { ...message, parts: [...message.parts] }
            : item
        ),
      })
    }
    if (controller.signal.aborted) {
      const latest = cache.get(input.chatId) ?? current
      write(input.chatId, {
        ...latest,
        streaming: false,
        messages: latest.messages.map((item) =>
          item.id === coach.id ? { ...item, status: "aborted" } : item
        ),
      })
      void stopChat(input.chatId).catch(() => undefined)
      return { restoreDraft: false, limited: false, error: null }
    }
    const latest = cache.get(input.chatId) ?? current
    write(input.chatId, {
      ...latest,
      streaming: false,
      messages: latest.messages.map((item) =>
        item.id === coach.id
          ? {
              ...item,
              status:
                item.status === "awaiting" || item.status === "aborted"
                  ? item.status
                  : "final",
            }
          : item
      ),
    })
    void refreshCoachMeta(input.chatId)
    return { restoreDraft: false, limited: false, error: null }
  } catch (error) {
    if (isAbortError(error) || controller.signal.aborted) {
      markStopped(input.chatId)
      void stopChat(input.chatId).catch(() => undefined)
      return { restoreDraft: false, limited: false, error: null }
    }
    const limited =
      error instanceof ApiError &&
      (error.status === 429 || error.code === ERROR_CODES.COACH_LIMIT_REACHED)
    if (!started) {
      return fail(limited ? null : coachSendErrorMessage(error), true, limited)
    }
    return fail(limited ? null : coachSendErrorMessage(error), false, limited)
  } finally {
    controllers.delete(input.chatId)
  }
}

function markStopped(chatId: string) {
  const latest = cache.get(chatId)
  if (!latest) return
  write(chatId, {
    ...latest,
    streaming: false,
    error: null,
    messages: latest.messages.map((item, index) =>
      index === latest.messages.length - 1 && item.role === "coach"
        ? { ...item, status: "aborted" }
        : item
    ),
  })
}

export function stopCoachTurn(chatId: string) {
  controllers.get(chatId)?.abort()
  markStopped(chatId)
  void stopChat(chatId).catch(() => undefined)
}

export function decideConfirm(
  chatId: string,
  pendingActionId: string,
  decided: "approved" | "denied"
) {
  const current = cache.get(chatId)
  if (!current) return
  write(chatId, {
    ...current,
    messages: current.messages.map((message) => ({
      ...message,
      status: message.status === "awaiting" ? "final" : message.status,
      parts: message.parts.map((part) =>
        part.kind === "confirm" && part.pendingActionId === pendingActionId
          ? { ...part, decided }
          : part
      ),
    })),
  })
}

export function markUndone(chatId: string, activityId: string) {
  const current = cache.get(chatId)
  if (!current) return
  write(chatId, {
    ...current,
    messages: current.messages.map((message) => ({
      ...message,
      parts: message.parts.map((part) =>
        part.kind === "result" && part.activityId === activityId
          ? { ...part, undone: true }
          : part
      ),
    })),
  })
}
