import { COACH_SSE_EVENTS } from "@workspace/domain"

import { isoNow, jsonError, jsonOk } from "./mock-http.ts"
import {
  DEFAULT_COACH_WORKED_MS,
  formatSse,
  mockState,
  readBody,
  scriptedParts,
  waitForPermit,
  type UsageOverride,
} from "./threads-api-mock-state.ts"

export function getLastNativeTurn() {
  return mockState.nativeTurn
}

export function getCoachCommandCalls() {
  return mockState.commandCalls
}

export function setMockCoachUsage(next: Partial<UsageOverride>) {
  mockState.usage = {
    ...mockState.usage,
    ...next,
    caps: { ...mockState.usage.caps, ...next.caps },
    day: { ...mockState.usage.day, ...next.day },
  }
}

function nativeTurnResponse(chatId: string, signal?: AbortSignal) {
  const encoder = new TextEncoder()
  const parts = scriptedParts()
  const steps = mockState.script.steps ?? []
  const confirm = mockState.script.confirm
  const result = mockState.script.result
  const workedMs = mockState.script.workedMs ?? DEFAULT_COACH_WORKED_MS
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = async (event: string, data: unknown) => {
        await waitForPermit(signal)
        if (signal?.aborted) return
        controller.enqueue(encoder.encode(formatSse(event, data)))
        mockState.gate.emitted += 1
      }
      try {
        await emit(COACH_SSE_EVENTS.messageStart, { chatId })
        for (const label of steps) {
          await emit(COACH_SSE_EVENTS.step, { label })
        }
        for (const part of parts) {
          if (part.kind === "text") {
            await emit(COACH_SSE_EVENTS.textDelta, { text: part.text })
          } else {
            await emit(COACH_SSE_EVENTS.step, { label: part.summary })
            await emit(COACH_SSE_EVENTS.toolResult, {
              name: part.name,
              summary: part.summary,
              ok: part.ok,
              ...(part.detail ? { detail: part.detail } : {}),
            })
          }
        }
        if (confirm) await emit(COACH_SSE_EVENTS.confirm, confirm)
        if (result) {
          await emit(COACH_SSE_EVENTS.toolResult, result)
        }
        await emit(COACH_SSE_EVENTS.usage, {
          plan: mockState.usage.plan,
          mode: mockState.usage.mode,
          capped: mockState.usage.day.capped,
        })
        await emit(COACH_SSE_EVENTS.messageEnd, { workedMs })
      } catch (error) {
        if (!(error instanceof Error && error.name === "AbortError")) throw error
      } finally {
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
    headers: { "Content-Type": "text/event-stream" },
  })
}

export async function handleNativeCoachRequest(
  path: string,
  method: string,
  init?: RequestInit
): Promise<Response | null> {
  if (method === "GET" && path === "/api/coach/usage") {
    return jsonOk({
      ...mockState.usage,
      session: { capped: false, resetsAt: mockState.usage.day.resetsAt },
      week: { capped: false, resetsAt: mockState.usage.day.resetsAt },
    })
  }

  const chatDetail = /^\/api\/chats\/([^/]+)$/.exec(path)
  if (method === "GET" && chatDetail) {
    const thread = mockState.threads.find((item) => item.id === chatDetail[1])
    if (thread) {
      return jsonOk({
        id: thread.id,
        title: thread.title,
        focusKind: thread.focusDocId ? "paper" : null,
        focusId: thread.focusDocId,
        createdAt: thread.createdAt,
        updatedAt: thread.updatedAt,
        messages: thread.messages.map((message) => ({
          id: message.id,
          chatId: thread.id,
          role: message.role === "coach" ? "coach" : "person",
          text: message.text,
          parts: message.parts ?? [],
          status: message.status ?? "final",
          workedMs: message.workedMs ?? null,
          createdAt: message.createdAt,
        })),
      })
    }
    return jsonOk({
      id: chatDetail[1],
      title: "New chat",
      focusKind: null,
      focusId: null,
      createdAt: isoNow(),
      updatedAt: isoNow(),
      messages: [],
    })
  }

  const turn = /^\/api\/chats\/([^/]+)\/turns$/.exec(path)
  if (method === "POST" && turn) {
    if (mockState.script.networkError) {
      mockState.script.networkError = false
      throw new TypeError("Failed to fetch")
    }
    if (mockState.script.httpError) {
      const error = mockState.script.httpError
      mockState.script.httpError = undefined
      return jsonError(error.status, error.code, error.message)
    }
    const body = (await readBody(init)) as {
      text?: string
      attachments?: unknown
    }
    mockState.nativeTurn = {
      chatId: turn[1]!,
      ...(body.text != null ? { text: body.text } : {}),
      ...(body.attachments != null ? { attachments: body.attachments } : {}),
    }
    return nativeTurnResponse(turn[1]!, init?.signal ?? undefined)
  }

  const stop = /^\/api\/chats\/([^/]+)\/stop$/.exec(path)
  if (method === "POST" && stop) {
    mockState.commandCalls.push({ name: "coach.stop", body: { chatId: stop[1] } })
    return jsonOk({ ok: true })
  }

  const command =
    /^\/api\/commands\/(actions\.approve|actions\.deny|activity\.undo|chat\.setFocus)$/.exec(
      path
    )
  if (method === "POST" && command) {
    const body = await readBody(init)
    mockState.commandCalls.push({ name: command[1]!, body })
    return jsonOk({ ok: true })
  }

  return null
}
