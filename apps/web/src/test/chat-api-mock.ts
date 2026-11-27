import type { CommandEnvelope } from "@workspace/domain/kernel"
import { undoneActivityRow } from "@/test/control-fixtures.ts"
import {
  appendCoachPart,
  deterministicChatTitle,
  shouldAutoTitleChat,
  textFromParts,
  DEFAULT_CHAT_TITLE,
  type CoachSelection,
  type ChatRecord,
  type ChatSummary,
  type ChatEntry,
  type ChatEntryPart,
  type ChatMessageStatus,
} from "@workspace/domain/coach"
import { vi } from "vitest"

import { FIXTURE_CHATS } from "./chat-fixtures.ts"
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
  chats: ChatRecord[]
}

const store: Store = {
  chats: cloneChats(FIXTURE_CHATS),
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

function cloneChats(chats: ChatRecord[]): ChatRecord[] {
  return structuredClone(chats)
}

function listItems(): ChatSummary[] {
  return [...store.chats]
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
  chat: ChatRecord,
  parts: ChatEntryPart[],
  status: ChatMessageStatus,
  workedMs = script.workedMs ?? DEFAULT_COACH_WORKED_MS,
  supersedesId?: string
): ChatEntry | null {
  const now = isoNow()
  const text = textFromParts(parts)
  const predecessor = supersedesId
    ? chat.messages.find((message) => message.id === supersedesId)
    : undefined
  if (predecessor && !text.trim()) return null
  const message: ChatEntry = {
    id: crypto.randomUUID(),
    role: "coach",
    text,
    createdAt: now,
    status,
    workedMs,
    parts: predecessor
      ? [
          ...(predecessor.parts ?? []).filter((part) => part.type === "tool"),
          ...parts,
        ]
      : parts,
  }
  if (predecessor) {
    chat.messages = chat.messages.map((item) =>
      item.id === predecessor.id ? message : item
    )
  } else chat.messages.push(message)
  chat.updatedAt = now
  if (!predecessor) maybeAutoTitle(chat, status, text)
  return message
}

function maybeAutoTitle(
  chat: ChatRecord,
  status: ChatMessageStatus,
  coachText: string
) {
  const prior = chat.messages.slice(0, -1)
  const eligible = shouldAutoTitleChat({
    currentTitle: chat.title,
    messages: prior,
    status,
  })
  if (!eligible) return
  chat.title = deterministicChatTitle({
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

function closeUnlessAlreadyClosed(
  controller: ReadableStreamDefaultController<Uint8Array>
) {
  try {
    controller.close()
  } catch {
    return
  }
}

function coachStreamResponse(
  chat: ChatRecord,
  signal?: AbortSignal,
  supersedesId?: string
) {
  const encoder = new TextEncoder()
  const partsToEmit = scriptedParts()
  const streamError = script.streamError
  const omitEnd = script.omitEnd === true
  const delayMs = script.delayMs ?? 0
  script.streamError = undefined

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let streamedParts: ChatEntryPart[] = []
      let started = false
      let aborted = false
      let persisted = false

      const persistOnce = (status: ChatMessageStatus) => {
        if (persisted) return undefined
        persisted = true
        return persistCoach(
          chat,
          streamedParts,
          status,
          undefined,
          supersedesId
        )
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
        closeUnlessAlreadyClosed(controller)
      }
      signal?.addEventListener("abort", onAbort, { once: true })
      if (signal?.aborted) onAbort()

      try {
        await emit(COACH_SSE_EVENTS.messageStart, { chatId: chat.id })
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
            const result: CommandEnvelope =
              part.result ??
              (part.ok
                ? { ok: true, data: {} }
                : {
                    ok: false,
                    error: { code: "NOT_FOUND", message: part.summary },
                  })
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

        const status: ChatMessageStatus = streamError ? "error" : "final"
        const message = persistOnce(status)
        if (message && !omitEnd) {
          await emit(COACH_SSE_EVENTS.messageEnd, { chatId: chat.id })
        }
      } catch (error) {
        if (!(error instanceof Error && error.name === "AbortError")) {
          throw error
        }
        if (started) persistOnce("aborted")
      } finally {
        signal?.removeEventListener("abort", onAbort)
        closeUnlessAlreadyClosed(controller)
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

export function resetChatApiMock() {
  store.chats = cloneChats(FIXTURE_CHATS)
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

export function getMockChats() {
  return store.chats
}

function chatRow(chat: ChatRecord) {
  return {
    id: chat.id,
    title: chat.title,
    focusKind: chat.focusDocId ? "paper" : null,
    focusId: chat.focusDocId,
    createdAt: chat.createdAt,
    updatedAt: chat.updatedAt,
  }
}

function chatDetail(chat: ChatRecord) {
  return {
    ...chatRow(chat),
    messages: chat.messages.map((message) => ({
      id: message.id,
      chatId: chat.id,
      role: message.role === "user" ? "person" : "coach",
      text: message.text,
      parts: message.parts ?? [],
      status: message.status ?? "final",
      workedMs: message.workedMs ?? null,
      createdAt: message.createdAt,
    })),
  }
}

export function setMockChats(
  chats: {
    id: string
    title: string
    createdAt?: string
    updatedAt?: string
  }[]
) {
  const now = isoNow()
  store.chats = chats.map((chat) => ({
    id: chat.id,
    title: chat.title,
    createdAt: chat.createdAt ?? now,
    updatedAt: chat.updatedAt ?? now,
    focusDocId: null,
    messages: structuredClone(
      FIXTURE_CHATS.find((fixture) => fixture.id === chat.id)?.messages ?? []
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

function newChat(title?: string, focusDocId?: string): ChatRecord {
  const now = isoNow()
  const created: ChatRecord = {
    id: crypto.randomUUID(),
    title: title?.trim() || DEFAULT_CHAT_TITLE,
    createdAt: now,
    updatedAt: now,
    focusDocId: focusDocId ?? null,
    messages: [],
  }
  store.chats.unshift(created)
  return created
}

export async function chatApiFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response | null> {
  const path = pathOf(input)
  const method = (init?.method ?? "GET").toUpperCase()

  if (method === "GET" && path === "/api/public-config")
    return Response.json({ google: false, coachDurable: false })

  if (method === "POST" && path === "/api/reads/chat.list") {
    return jsonOk(listItems().map((item) => chatRow(item as ChatRecord)))
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
      context?: { kind: string; id: string }[]
    }
    lastCoachRequest = {
      chatId: turn[1]!,
      ...(body.text != null ? { text: body.text } : {}),
      ...(body.mode != null ? { mode: body.mode } : {}),
      ...(body.regenerate ? { regenerate: true } : {}),
      ...(body.focusDocId ? { focusDocId: body.focusDocId } : {}),
      ...(body.selection ? { selection: body.selection } : {}),
      ...(body.context ? { context: body.context } : {}),
    }
    const chat = store.chats.find((item) => item.id === turn[1])
    if (!chat) {
      return jsonError(404, "NOT_FOUND", "Chat not found")
    }
    const now = isoNow()
    if (!body.regenerate) {
      chat.messages.push({
        id: crypto.randomUUID(),
        role: "user",
        text: body.text ?? "",
        createdAt: now,
      })
    }
    chat.updatedAt = now
    const lastUserIndex = chat.messages.findLastIndex(
      (message) => message.role === "user"
    )
    const currentCoach = chat.messages.findLast(
      (message, index) => message.role === "coach" && index > lastUserIndex
    )
    return coachStreamResponse(
      chat,
      init?.signal ?? undefined,
      body.regenerate ? currentCoach?.id : undefined
    )
  }

  if (method === "POST" && path === "/api/reads/chat.get") {
    const { chatId } = (await readBody(init)) as { chatId?: string }
    const chat = store.chats.find((item) => item.id === chatId)
    if (!chat) {
      return jsonError(404, "NOT_FOUND", "Chat not found")
    }
    return jsonOk(chatDetail(chat))
  }

  if (method !== "POST" || !path.startsWith("/api/commands/")) return null
  const name = path.slice("/api/commands/".length)

  if (name === "chat.create") {
    const body = commandInput(init)
    createCalls.push(init?.body ? JSON.parse(String(init.body)) : null)
    return jsonOk(chatDetail(newChat(body.title as string | undefined)))
  }

  if (name === "chat.open") {
    const focus = commandInput(init).focus as { id: string } | undefined
    const existing = store.chats.find(
      (item) => focus && item.focusDocId === focus.id
    )
    return jsonOk(chatDetail(existing ?? newChat(undefined, focus?.id)))
  }

  if (name === "chat.rename") {
    const body = commandInput(init)
    const chat = store.chats.find((item) => item.id === body.chatId)
    if (!chat) return jsonError(404, "NOT_FOUND", "Chat not found")
    chat.title = String(body.title)
    return jsonOk(chatDetail(chat))
  }

  if (name === "chat.delete") {
    const body = commandInput(init)
    const index = store.chats.findIndex((item) => item.id === body.chatId)
    if (index === -1) return jsonError(404, "NOT_FOUND", "Chat not found")
    const [removed] = store.chats.splice(index, 1)
    return jsonOk({ id: removed!.id })
  }

  if (name === "activity.undo") {
    const activityId = String(commandInput(init).activityId ?? "")
    for (const chat of store.chats) {
      for (const message of chat.messages) {
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
        return jsonOk(undoneActivityRow(activityId))
      }
    }
  }

  return null
}

export async function chatApiFetchOrThrow(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const response = await chatApiFetch(input, init)
  if (response) return response
  throw new Error(
    `Unexpected fetch: ${(init?.method ?? "GET").toUpperCase()} ${pathOf(input)}`
  )
}

export function installChatApiMock() {
  vi.stubGlobal("fetch", chatApiFetchOrThrow)
}

export const COACH_SSE_EVENTS = {
  messageStart: "message-start",
  textDelta: "text-delta",
  step: "step",
  toolCall: "tool-call",
  toolResult: "tool-result",
  confirm: "confirm",
  usage: "usage",
  messageEnd: "message-end",
  error: "error",
} as const
