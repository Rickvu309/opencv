import {
  appendCoachPart,
  COACH_SSE_EVENTS,
  deterministicThreadTitle,
  shouldAutoTitleThread,
  textFromParts,
  DEFAULT_THREAD_TITLE,
  type CoachSelection,
  type ThreadDetail,
  type ThreadListItem,
  type ThreadMessage,
  type ThreadMessagePart,
  type ThreadMessageStatus,
} from "@workspace/domain"
import { vi } from "vitest"

import { FIXTURE_THREADS } from "./thread-fixtures.ts"
import type {
  CoachScriptPart,
  CoachStreamControl,
  CoachStreamScript,
  GateState,
  LastCoachRequest,
} from "./coach-stream-types.ts"
import { isoNow, pathOf, jsonOk, jsonError } from "./mock-http.ts"

export const DEFAULT_COACH_STREAM_TEXTS = [
  "I looked at Apply. ",
  "Prep the starred one next.",
] as const

export const DEFAULT_COACH_STREAM_REPLY = DEFAULT_COACH_STREAM_TEXTS.join("")

export const DEFAULT_COACH_WORKED_MS = 1100

type Store = {
  threads: ThreadDetail[]
}

const store: Store = {
  threads: cloneThreads(FIXTURE_THREADS),
}

let script: CoachStreamScript = {}
let gate: GateState = openGate()
let lastCoachRequest: LastCoachRequest | null = null
let createCalls: unknown[] = []

function openGate(): GateState {
  return {
    permits: 0,
    waiters: [],
    releasedAll: true,
    emitted: 0,
  }
}

function cloneThreads(threads: ThreadDetail[]): ThreadDetail[] {
  return structuredClone(threads)
}

function listItems(): ThreadListItem[] {
  return [...store.threads]
    .sort((a, b) => {
      const byUpdated = b.updatedAt.localeCompare(a.updatedAt)
      if (byUpdated !== 0) return byUpdated
      return b.id.localeCompare(a.id)
    })
    .map(({ id, title, createdAt, updatedAt, focusDocId }) => ({
      id,
      title,
      createdAt,
      updatedAt,
      focusDocId,
    }))
}

async function readBody(init?: RequestInit): Promise<unknown> {
  if (init?.body == null) return {}
  const text = String(init.body)
  if (text.trim() === "") return {}
  return JSON.parse(text) as unknown
}

function formatSse(event: string, data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
}

function persistCoach(
  thread: ThreadDetail,
  parts: ThreadMessagePart[],
  status: ThreadMessageStatus,
  workedMs = script.workedMs ?? DEFAULT_COACH_WORKED_MS
): ThreadMessage {
  const now = isoNow()
  const text = textFromParts(parts)
  const message: ThreadMessage = {
    id: crypto.randomUUID(),
    role: "coach",
    text,
    createdAt: now,
    status,
    workedMs,
    parts,
  }
  thread.messages.push(message)
  thread.updatedAt = now
  maybeAutoTitle(thread, status, text)
  return message
}

function maybeAutoTitle(
  thread: ThreadDetail,
  status: ThreadMessageStatus,
  coachText: string
) {
  const prior = thread.messages.slice(0, -1)
  const eligible = shouldAutoTitleThread({
    currentTitle: thread.title,
    messages: prior,
    status,
  })
  if (!eligible) return
  thread.title = deterministicThreadTitle({
    userText: eligible.userText,
    coachText,
  })
}

function scriptedParts(): CoachScriptPart[] {
  if (script.parts) return [...script.parts]
  return (script.texts ?? DEFAULT_COACH_STREAM_TEXTS).map((text) => ({
    kind: "text" as const,
    text,
  }))
}

async function waitForPermit(signal?: AbortSignal) {
  if (gate.releasedAll) return
  if (gate.permits > 0) {
    gate.permits -= 1
    return
  }

  await new Promise<void>((resolve, reject) => {
    const onAbort = () => {
      reject(new DOMException("Aborted", "AbortError"))
    }
    if (signal?.aborted) {
      onAbort()
      return
    }
    signal?.addEventListener("abort", onAbort, { once: true })
    gate.waiters.push(() => {
      signal?.removeEventListener("abort", onAbort)
      resolve()
    })
  })
}

async function waitDelay(ms: number, signal?: AbortSignal) {
  if (ms <= 0) return
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms)
    const onAbort = () => {
      clearTimeout(timer)
      reject(new DOMException("Aborted", "AbortError"))
    }
    if (signal?.aborted) {
      onAbort()
      return
    }
    signal?.addEventListener("abort", onAbort, { once: true })
  })
}

function coachStreamResponse(thread: ThreadDetail, signal?: AbortSignal) {
  const encoder = new TextEncoder()
  const partsToEmit = scriptedParts()
  const streamError = script.streamError
  const omitEnd = script.omitEnd === true
  const delayMs = script.delayMs ?? 0
  script.streamError = undefined

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let streamedParts: ThreadMessagePart[] = []
      let started = false
      let aborted = false
      let persisted = false

      const persistOnce = (status: ThreadMessageStatus) => {
        if (persisted) return undefined
        persisted = true
        return persistCoach(thread, streamedParts, status)
      }

      const emit = async (event: string, data: unknown) => {
        await waitForPermit(signal)
        await waitDelay(delayMs, signal)
        if (signal?.aborted) {
          aborted = true
          return
        }
        controller.enqueue(encoder.encode(formatSse(event, data)))
        gate.emitted += 1
      }

      const onAbort = () => {
        aborted = true
        persistOnce("aborted")
        try {
          controller.close()
        } catch {
          // already closed
        }
      }
      signal?.addEventListener("abort", onAbort, { once: true })
      if (signal?.aborted) onAbort()

      try {
        await emit(COACH_SSE_EVENTS.messageStart, { chatId: thread.id })
        if (aborted) return
        started = true

        for (const part of partsToEmit) {
          if (part.kind === "text") {
            await emit(COACH_SSE_EVENTS.textDelta, { text: part.text })
            if (aborted) break
            streamedParts = appendCoachPart(streamedParts, {
              type: "text-delta",
              text: part.text,
            })
          } else {
            const toolCallId = crypto.randomUUID()
            const activityId =
              part.ok && part.reversal?.possible
                ? crypto.randomUUID()
                : undefined
            const result = part.result ?? {
              ok: part.ok,
              ...(part.ok
                ? { data: {} }
                : {
                    error: {
                      code: "NOT_FOUND",
                      message: part.summary,
                    },
                  }),
            }
            await emit(COACH_SSE_EVENTS.toolCall, {
              toolCallId,
              name: part.name,
              input: {},
            })
            if (aborted) break
            await emit(COACH_SSE_EVENTS.toolResult, {
              toolCallId,
              name: part.name,
              summary: part.summary,
              ok: part.ok,
              ...(part.reversal ? { reversal: part.reversal } : {}),
              ...(part.detail ? { detail: part.detail } : {}),
              ...(activityId ? { activityId } : {}),
              result,
            })
            if (aborted) break
            streamedParts = appendCoachPart(streamedParts, {
              type: "tool-result",
              toolCallId,
              name: part.name,
              summary: part.summary,
              ok: part.ok,
              ...(part.reversal ? { reversal: part.reversal } : {}),
              ...(part.detail ? { detail: part.detail } : {}),
              ...(activityId ? { activityId } : {}),
              result,
            })
          }
          if (aborted) break
        }

        if (!aborted && streamError) {
          await emit(COACH_SSE_EVENTS.error, { message: streamError })
        }

        if (aborted || signal?.aborted) {
          persistOnce("aborted")
          return
        }

        const status: ThreadMessageStatus = streamError ? "error" : "final"
        const message = persistOnce(status)
        if (message && !omitEnd) {
          await emit(COACH_SSE_EVENTS.messageEnd, { chatId: thread.id })
        }
      } catch (error) {
        if (!(error instanceof Error && error.name === "AbortError")) {
          throw error
        }
        if (started) persistOnce("aborted")
      } finally {
        signal?.removeEventListener("abort", onAbort)
        try {
          controller.close()
        } catch {
          // already closed
        }
      }
    },
  })

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
    },
  })
}

export function resetThreadApiMock() {
  store.threads = cloneThreads(FIXTURE_THREADS)
  script = {}
  gate = openGate()
  lastCoachRequest = null
  createCalls = []
}

export function getLastCoachRequest() {
  return lastCoachRequest
}

export function scriptCoachStream(
  next: CoachStreamScript = {}
): CoachStreamControl {
  script = { ...next }
  gate = {
    permits: 0,
    waiters: [],
    releasedAll: next.gated !== true,
    emitted: 0,
  }

  return {
    release(count = 1) {
      for (let i = 0; i < count; i += 1) {
        const waiter = gate.waiters.shift()
        if (waiter) waiter()
        else gate.permits += 1
      }
    },
    releaseAll() {
      gate.releasedAll = true
      while (gate.waiters.length > 0) {
        gate.waiters.shift()?.()
      }
    },
    emitted: () => gate.emitted,
  }
}

export function getMockThreads() {
  return store.threads
}

function chatRow(thread: ThreadDetail) {
  return {
    id: thread.id,
    title: thread.title,
    focusKind: thread.focusDocId ? "paper" : null,
    focusId: thread.focusDocId,
    createdAt: thread.createdAt,
    updatedAt: thread.updatedAt,
  }
}

function chatDetail(thread: ThreadDetail) {
  return {
    ...chatRow(thread),
    messages: thread.messages.map((message) => ({
      ...message,
      role: message.role === "user" ? "person" : "coach",
      parts: message.parts ?? [],
      status: message.status ?? "final",
      workedMs: message.workedMs ?? null,
    })),
  }
}

export function setMockChats(chats: { id: string; title: string }[]) {
  const now = isoNow()
  store.threads = chats.map((chat) => ({
    id: chat.id,
    title: chat.title,
    createdAt: now,
    updatedAt: now,
    focusDocId: null,
    messages: structuredClone(
      FIXTURE_THREADS.find((fixture) => fixture.id === chat.id)?.messages ?? []
    ),
  }))
}

export function chatCreateCalls() {
  return createCalls
}

function commandInput(init?: RequestInit) {
  const body = init?.body ? JSON.parse(String(init.body)) : {}
  return (
    body && typeof body === "object" && "input" in body ? body.input : body
  ) as Record<string, unknown>
}

function newThread(title?: string, focusDocId?: string): ThreadDetail {
  const now = isoNow()
  const created: ThreadDetail = {
    id: crypto.randomUUID(),
    title: title?.trim() || DEFAULT_THREAD_TITLE,
    createdAt: now,
    updatedAt: now,
    focusDocId: focusDocId ?? null,
    messages: [],
  }
  store.threads.unshift(created)
  return created
}

export async function threadApiFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response | null> {
  const path = pathOf(input)
  const method = (init?.method ?? "GET").toUpperCase()

  if (method === "GET" && path === "/api/chats") {
    return jsonOk(listItems().map((item) => chatRow(item as ThreadDetail)))
  }

  const turn = /^\/api\/chats\/([^/]+)\/turns$/.exec(path)
  if (method === "POST" && turn) {
    if (script.networkError) {
      script.networkError = false
      throw new TypeError("Failed to fetch")
    }
    if (script.httpError) {
      const error = script.httpError
      script.httpError = undefined
      return jsonError(error.status, error.code, error.message)
    }

    const body = (await readBody(init)) as {
      text?: string
      mode?: string
      regenerate?: boolean
      focusDocId?: string
      selection?: CoachSelection
    }
    lastCoachRequest = {
      threadId: turn[1]!,
      ...(body.text != null ? { text: body.text } : {}),
      ...(body.mode != null ? { mode: body.mode } : {}),
      ...(body.regenerate ? { regenerate: true } : {}),
      ...(body.focusDocId ? { focusDocId: body.focusDocId } : {}),
      ...(body.selection ? { selection: body.selection } : {}),
    }
    const thread = store.threads.find((item) => item.id === turn[1])
    if (!thread) {
      return jsonError(404, "NOT_FOUND", "Chat not found")
    }
    const now = isoNow()
    if (!body.regenerate) {
      thread.messages.push({
        id: crypto.randomUUID(),
        role: "user",
        text: body.text ?? "",
        createdAt: now,
      })
    }
    thread.updatedAt = now
    return coachStreamResponse(thread, init?.signal ?? undefined)
  }

  const detail = /^\/api\/chats\/([^/]+)$/.exec(path)
  if (method === "GET" && detail) {
    const thread = store.threads.find((item) => item.id === detail[1])
    if (!thread) {
      return jsonError(404, "NOT_FOUND", "Chat not found")
    }
    return jsonOk(chatDetail(thread))
  }

  if (method !== "POST" || !path.startsWith("/api/commands/")) return null
  const name = path.slice("/api/commands/".length)

  if (name === "chat.create") {
    const body = commandInput(init)
    createCalls.push(init?.body ? JSON.parse(String(init.body)) : null)
    return jsonOk(chatDetail(newThread(body.title as string | undefined)))
  }

  if (name === "chat.open") {
    const focus = commandInput(init).focus as { id: string } | undefined
    const existing = store.threads.find(
      (item) => focus && item.focusDocId === focus.id
    )
    return jsonOk(chatDetail(existing ?? newThread(undefined, focus?.id)))
  }

  if (name === "chat.rename") {
    const body = commandInput(init)
    const thread = store.threads.find((item) => item.id === body.chatId)
    if (!thread) return jsonError(404, "NOT_FOUND", "Chat not found")
    thread.title = String(body.title)
    return jsonOk(chatDetail(thread))
  }

  if (name === "chat.delete") {
    const body = commandInput(init)
    const index = store.threads.findIndex((item) => item.id === body.chatId)
    if (index === -1) return jsonError(404, "NOT_FOUND", "Chat not found")
    const [removed] = store.threads.splice(index, 1)
    return jsonOk({ id: removed!.id })
  }

  if (name === "activity.undo") {
    const activityId = String(commandInput(init).activityId ?? "")
    for (const thread of store.threads) {
      for (const message of thread.messages) {
        const part = message.parts?.find(
          (item) => item.type === "tool" && item.activityId === activityId
        )
        if (!part || part.type !== "tool") continue
        if (script.undoError) {
          const error = script.undoError
          script.undoError = undefined
          return jsonError(error.status, error.code, error.message)
        }
        if (script.undoFail) {
          const failure = script.undoFail
          script.undoFail = undefined
          return jsonError(409, "CONFLICT", failure.summary)
        }
        part.undone = true
        return jsonOk({ activityId })
      }
    }
  }

  return null
}

export async function threadApiFetchOrThrow(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const response = await threadApiFetch(input, init)
  if (response) return response
  throw new Error(
    `Unexpected fetch: ${(init?.method ?? "GET").toUpperCase()} ${pathOf(input)}`
  )
}

export function installThreadApiMock() {
  vi.stubGlobal("fetch", threadApiFetchOrThrow)
}
