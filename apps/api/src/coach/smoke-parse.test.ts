import { describe, expect, it } from "vitest"

import { analyzeCoachStream, consumeSseChunk } from "./smoke-parse.js"

describe("consumeSseChunk", () => {
  it("keeps a partial trailing block in rest", () => {
    const { frames, rest } = consumeSseChunk(
      "event: message-start\ndata: {\"threadId\":\"t1\"}\n\nevent: text-delta\ndata: {\"text\":\"Hi",
      12
    )
    expect(frames).toEqual([
      {
        kind: "event",
        event: "message-start",
        data: { threadId: "t1" },
        atMs: 12,
      },
    ])
    expect(rest).toBe("event: text-delta\ndata: {\"text\":\"Hi")
  })

  it("counts comment-only blocks as heartbeats", () => {
    const { frames } = consumeSseChunk(": heartbeat\n\n", 15_000)
    expect(frames).toEqual([{ kind: "heartbeat", atMs: 15_000 }])
  })
})

describe("analyzeCoachStream", () => {
  it("treats an immediate message-start as a flushed proxy", () => {
    const analysis = analyzeCoachStream([
      { kind: "event", event: "message-start", data: { threadId: "t" }, atMs: 80 },
      { kind: "event", event: "text-delta", data: { text: "Hi" }, atMs: 400 },
      { kind: "heartbeat", atMs: 15_100 },
      { kind: "event", event: "message-end", data: {}, atMs: 16_000 },
    ])
    expect(analysis.messageStartFlushed).toBe(true)
    expect(analysis.looksBuffered).toBe(false)
    expect(analysis.heartbeatCount).toBe(1)
    expect(analysis.text).toBe("Hi")
  })

  it("flags a late burst as buffered", () => {
    const analysis = analyzeCoachStream([
      { kind: "event", event: "message-start", data: {}, atMs: 8_000 },
      { kind: "event", event: "text-delta", data: { text: "all" }, atMs: 8_010 },
      { kind: "event", event: "message-end", data: {}, atMs: 8_020 },
    ])
    expect(analysis.messageStartFlushed).toBe(false)
    expect(analysis.looksBuffered).toBe(true)
  })
})
