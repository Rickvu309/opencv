import { vi } from "vitest"

import { chatApiFetchOrThrow } from "./chat-api-mock.ts"

/** A turn stream the test feeds one wire event at a time. */
export function liveTurn() {
  const encoder = new TextEncoder()
  let controller!: ReadableStreamDefaultController<Uint8Array>
  const body = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c
    },
  })
  vi.stubGlobal(
    "fetch",
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(
        typeof input === "string" ? input : String(input),
        "http://x"
      )
      if (
        (init?.method ?? "GET").toUpperCase() === "POST" &&
        /^\/api\/chats\/[^/]+\/turns$/.test(url.pathname)
      )
        return new Response(body, {
          status: 200,
          headers: { "Content-Type": "text/event-stream" },
        })
      return chatApiFetchOrThrow(input, init)
    }
  )
  return {
    emit(event: string, data: unknown) {
      controller.enqueue(
        encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
      )
    },
    close() {
      controller.close()
    },
  }
}

export const step = (label: string) => ({ event: "step", data: { label } })
export const call = (toolCallId: string, name: string) => ({
  event: "tool-call",
  data: { toolCallId, name, input: {} },
})
export const result = (
  toolCallId: string,
  name: string,
  extra: Record<string, unknown> = {}
) => ({
  event: "tool-result",
  data: {
    toolCallId,
    name,
    summary: `${name} done`,
    ok: true,
    result: { ok: true, data: {} },
    ...extra,
  },
})
