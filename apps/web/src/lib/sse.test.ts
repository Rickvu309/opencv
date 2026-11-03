import { describe, expect, it } from "vitest"

import { consumeSseBuffer, parseSseBlock, readSseStream } from "./sse.ts"

describe("parseSseBlock", () => {
  it("parses an event and JSON data", () => {
    expect(parseSseBlock('event: text-delta\ndata: {"text":"Hi"}')).toEqual({
      event: "text-delta",
      data: { text: "Hi" },
    })
  })

  it("skips heartbeats and comment-only blocks", () => {
    expect(parseSseBlock(": heartbeat")).toBeNull()
    expect(parseSseBlock(": keep-alive\n:")).toBeNull()
  })

  it("joins multi-line data fields", () => {
    expect(parseSseBlock('event: error\ndata: {"message":"a"}\n')).toEqual({
      event: "error",
      data: { message: "a" },
    })
  })
})

describe("consumeSseBuffer", () => {
  it("yields complete events and keeps a partial block", () => {
    const { events, rest } = consumeSseBuffer(
      'event: message-start\ndata: {"chatId":"t1"}\n\nevent: text-delta\ndata: {"text":"Hel'
    )

    expect(events).toEqual([{ event: "message-start", data: { chatId: "t1" } }])
    expect(rest).toBe('event: text-delta\ndata: {"text":"Hel')
  })

  it("accepts CRLF delimiters and skips heartbeats", () => {
    const { events, rest } = consumeSseBuffer(
      ': heartbeat\r\n\r\nevent: text-delta\r\ndata: {"text":"A"}\r\n\r\n'
    )

    expect(events).toEqual([{ event: "text-delta", data: { text: "A" } }])
    expect(rest).toBe("")
  })
})

describe("readSseStream", () => {
  it("reads events across chunk boundaries", async () => {
    const encoder = new TextEncoder()
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode('event: text-delta\ndata: {"text":"'))
        controller.enqueue(encoder.encode('Hel"}\n\nevent: text-delta\n'))
        controller.enqueue(encoder.encode('data: {"text":"lo"}\n\n'))
        controller.close()
      },
    })

    const events = []
    for await (const event of readSseStream(stream)) {
      events.push(event)
    }

    expect(events).toEqual([
      { event: "text-delta", data: { text: "Hel" } },
      { event: "text-delta", data: { text: "lo" } },
    ])
  })

  it("throws when the signal aborts", async () => {
    const controller = new AbortController()
    const stream = new ReadableStream<Uint8Array>({
      start() {
        controller.abort()
      },
    })

    await expect(async () => {
      const iterator = readSseStream(stream, {
        signal: controller.signal,
      })
      await iterator.next()
    }).rejects.toMatchObject({ name: "AbortError" })
  })

  it("stops a read that is waiting for the next chunk as soon as Stop aborts", async () => {
    const encoder = new TextEncoder()
    const controller = new AbortController()
    const stream = new ReadableStream<Uint8Array>({
      start(source) {
        source.enqueue(
          encoder.encode('event: text-delta\ndata: {"text":"Hi"}\n\n')
        )
      },
    })
    const iterator = readSseStream(stream, { signal: controller.signal })

    await expect(iterator.next()).resolves.toMatchObject({
      value: { event: "text-delta", data: { text: "Hi" } },
    })
    const waitingForNextChunk = iterator.next()
    controller.abort()
    const neverArrives = new Promise((resolve) =>
      setTimeout(() => resolve("still waiting for a chunk"), 200)
    )

    await expect(
      Promise.race([waitingForNextChunk, neverArrives])
    ).rejects.toMatchObject({ name: "AbortError" })
  })
})
