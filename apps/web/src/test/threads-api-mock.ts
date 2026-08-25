import {
  appendCoachPart,
  COACH_SSE_EVENTS,
  textFromParts,
  DEFAULT_THREAD_TITLE,
  THREAD_COMMANDS,
  type CoachUsageRating,
  type CommandEnvelope,
  type ReversalDescriptor,
  type ThreadDetail,
  type ThreadListItem,
  type ThreadMessage,
  type ThreadMessagePart,
  type ThreadMessageStatus,
} from "@workspace/domain"
import { vi } from "vitest"

import { apiBaseUrl } from "@/lib/api-url.ts"

import { FIXTURE_THREADS } from "./thread-fixtures.ts"

export const DEFAULT_COACH_STREAM_TEXTS = [
  "I looked at Apply. ",
  "Prep the starred one next.",
] as const

export const DEFAULT_COACH_STREAM_REPLY = DEFAULT_COACH_STREAM_TEXTS.join("")

export const DEFAULT_COACH_WORKED_MS = 1100

export type CoachScriptPart =
  | { kind: "text"; text: string }
  | {
      kind: "tool"
      name: string
      summary: string
      ok: boolean
      reversal?: ReversalDescriptor
      result?: CommandEnvelope
    }

export type CoachStreamScript = {
  gated?: boolean
  delayMs?: number
  texts?: readonly string[]
  parts?: readonly CoachScriptPart[]
  httpError?: { status: number; code: string; message: string }
  networkError?: boolean
  streamError?: string
  omitEnd?: boolean
  workedMs?: number
}

export type CoachStreamControl = {
  release: (count?: number) => void
  releaseAll: () => void
  emitted: () => number
}

type Store = {
  threads: ThreadDetail[]
}

type GateState = {
  permits: number
  waiters: Array<() => void>
  releasedAll: boolean
  emitted: number
}

const store: Store = {
  threads: cloneThreads(FIXTURE_THREADS),
}

let script: CoachStreamScript = {}
let gate: GateState = openGate()

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

function isoNow() {
  return new Date().toISOString()
}

function pathOf(input: RequestInfo | URL) {
  const raw =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.href
        : input.url
  return new URL(raw, apiBaseUrl).pathname
}

function jsonOk<T>(data: T, status = 200) {
  return Response.json({ ok: true, data }, { status })
}

function jsonError(status: number, code: string, message: string) {
  return Response.json({ ok: false, error: { code, message } }, { status })
}

function listItems(): ThreadListItem[] {
  return [...store.threads]
    .sort((a, b) => {
      const byUpdated = b.updatedAt.localeCompare(a.updatedAt)
      if (byUpdated !== 0) return byUpdated
      return b.id.localeCompare(a.id)
    })
    .map(({ id, title, createdAt, updatedAt }) => ({
      id,
      title,
      createdAt,
      updatedAt,
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
    rating: null,
  }
  thread.messages.push(message)
  thread.updatedAt = now
  return message
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
        await emit(COACH_SSE_EVENTS.messageStart, { threadId: thread.id })
        if (aborted) return
        started = true

        for (const part of partsToEmit) {
          if (part.kind === "text") {
            streamedParts = appendCoachPart(streamedParts, {
              type: "text-delta",
              text: part.text,
            })
            await emit(COACH_SSE_EVENTS.textDelta, { text: part.text })
          } else {
            const toolCallId = crypto.randomUUID()
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
            streamedParts = appendCoachPart(streamedParts, {
              type: "tool-result",
              toolCallId,
              name: part.name,
              summary: part.summary,
              ok: part.ok,
              ...(part.reversal ? { reversal: part.reversal } : {}),
              result,
            })
            await emit(COACH_SSE_EVENTS.toolResult, {
              toolCallId,
              name: part.name,
              summary: part.summary,
              ok: part.ok,
              ...(part.reversal ? { reversal: part.reversal } : {}),
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
          await emit(COACH_SSE_EVENTS.messageEnd, {
            message,
            usage: {
              model: "mock",
              latencyMs: message.workedMs,
              finishReason: status,
            },
          })
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

export async function threadApiFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const path = pathOf(input)
  const method = (init?.method ?? "GET").toUpperCase()

  if (method === "GET" && path === "/api/threads") {
    return jsonOk(listItems())
  }

  const coach = /^\/api\/threads\/([^/]+)\/coach$/.exec(path)
  if (method === "POST" && coach) {
    if (script.networkError) {
      script.networkError = false
      throw new TypeError("Failed to fetch")
    }
    if (script.httpError) {
      const error = script.httpError
      script.httpError = undefined
      return jsonError(error.status, error.code, error.message)
    }

    const body = (await readBody(init)) as { text?: string }
    const thread = store.threads.find((item) => item.id === coach[1])
    if (!thread) {
      return jsonError(404, "NOT_FOUND", "Thread not found")
    }
    const now = isoNow()
    thread.messages.push({
      id: crypto.randomUUID(),
      role: "user",
      text: body.text ?? "",
      createdAt: now,
    })
    thread.updatedAt = now
    return coachStreamResponse(thread, init?.signal ?? undefined)
  }

  const feedback =
    /^\/api\/threads\/([^/]+)\/messages\/([^/]+)\/feedback$/.exec(path)
  if (method === "POST" && feedback) {
    const thread = store.threads.find((item) => item.id === feedback[1])
    const message = thread?.messages.find((item) => item.id === feedback[2])
    if (!thread || !message || message.role !== "coach") {
      return jsonError(404, "NOT_FOUND", "Coach turn not found")
    }
    const body = (await readBody(init)) as { rating?: CoachUsageRating }
    if (body.rating !== "up" && body.rating !== "down") {
      return jsonError(400, "VALIDATION_ERROR", "Invalid rating")
    }
    message.rating = body.rating
    return jsonOk({ messageId: message.id, rating: body.rating })
  }

  const detail = /^\/api\/threads\/([^/]+)$/.exec(path)
  if (method === "GET" && detail) {
    const thread = store.threads.find((item) => item.id === detail[1])
    if (!thread) {
      return jsonError(404, "NOT_FOUND", "Thread not found")
    }
    return jsonOk(thread)
  }

  if (method === "POST" && path === `/api/commands/${THREAD_COMMANDS.create}`) {
    const body = (await readBody(init)) as { title?: string }
    const now = isoNow()
    const created: ThreadDetail = {
      id: crypto.randomUUID(),
      title: body.title?.trim() || DEFAULT_THREAD_TITLE,
      createdAt: now,
      updatedAt: now,
      messages: [],
    }
    store.threads.unshift(created)
    return jsonOk({
      id: created.id,
      title: created.title,
      createdAt: created.createdAt,
      updatedAt: created.updatedAt,
    })
  }

  if (
    method === "POST" &&
    path === `/api/commands/${THREAD_COMMANDS.postMessage}`
  ) {
    const body = (await readBody(init)) as { threadId?: string; text?: string }
    const thread = store.threads.find((item) => item.id === body.threadId)
    if (!thread) {
      return jsonError(404, "NOT_FOUND", "Thread not found")
    }
    const now = isoNow()
    thread.messages.push({
      id: crypto.randomUUID(),
      role: "user",
      text: body.text ?? "",
      createdAt: now,
    })
    thread.updatedAt = now
    return jsonOk(thread)
  }

  throw new Error(`Unexpected fetch: ${method} ${path}`)
}

export function installThreadApiMock() {
  vi.stubGlobal("fetch", threadApiFetch)
}
