export type SseFrame =
  | { kind: "heartbeat"; atMs: number }
  | { kind: "event"; event: string; data: unknown; atMs: number }

/**
 * Split a decoded SSE buffer into complete frames. Incomplete trailing
 * bytes stay in `rest` so a live reader can append the next chunk.
 */
export function consumeSseChunk(
  buffer: string,
  atMs: number
): { frames: SseFrame[]; rest: string } {
  const frames: SseFrame[] = []
  const blocks = buffer.split(/\r?\n\r?\n/)
  const complete = buffer.match(/\r?\n\r?\n$/) ? blocks : blocks.slice(0, -1)
  const rest = buffer.match(/\r?\n\r?\n$/) ? "" : (blocks.at(-1) ?? "")

  for (const block of complete) {
    const lines = block.split(/\r?\n/).filter((line) => line.length > 0)
    if (lines.length === 0) continue
    if (lines.every((line) => line.startsWith(":"))) {
      frames.push({ kind: "heartbeat", atMs })
      continue
    }

    let event = "message"
    const dataLines: string[] = []
    for (const line of lines) {
      if (line.startsWith(":")) continue
      if (line.startsWith("event:")) event = line.slice("event:".length).trim()
      else if (line.startsWith("data:")) {
        dataLines.push(line.slice("data:".length).trimStart())
      }
    }
    if (dataLines.length === 0) continue
    frames.push({
      kind: "event",
      event,
      data: JSON.parse(dataLines.join("\n")),
      atMs,
    })
  }

  return { frames, rest }
}

export type StreamAnalysis = {
  events: string[]
  heartbeatCount: number
  firstEventMs?: number
  lastEventMs?: number
  /** `message-start` arrived before the first-flush budget. */
  messageStartFlushed: boolean
  /**
   * True when the first event is late and every later event piles in at
   * the same instant — the proxy (or something else) buffered the body.
   */
  looksBuffered: boolean
  toolNames: string[]
  text: string
}

const FIRST_FLUSH_MS = 3_000
const BURST_MS = 150

export function analyzeCoachStream(
  frames: SseFrame[],
  firstFlushMs = FIRST_FLUSH_MS
): StreamAnalysis {
  const events = frames
    .filter((frame): frame is Extract<SseFrame, { kind: "event" }> => {
      return frame.kind === "event"
    })
  const heartbeats = frames.filter((frame) => frame.kind === "heartbeat")
  const firstEventMs = events[0]?.atMs
  const lastEventMs = events.at(-1)?.atMs
  const text = events
    .filter((frame) => frame.event === "text-delta")
    .map((frame) => {
      const data = frame.data as { text?: string }
      return data.text ?? ""
    })
    .join("")
  const toolNames = events
    .filter((frame) => frame.event === "tool-result")
    .map((frame) => {
      const data = frame.data as { name?: string }
      return data.name ?? ""
    })
    .filter(Boolean)

  const later = events.slice(1)
  const piledIn =
    later.length > 0 &&
    later.every(
      (frame) => Math.abs(frame.atMs - (lastEventMs ?? frame.atMs)) <= BURST_MS
    )
  const firstLate =
    firstEventMs !== undefined && firstEventMs > firstFlushMs

  return {
    events: events.map((frame) => frame.event),
    heartbeatCount: heartbeats.length,
    firstEventMs,
    lastEventMs,
    messageStartFlushed:
      events[0]?.event === "message-start" &&
      firstEventMs !== undefined &&
      firstEventMs <= firstFlushMs,
    looksBuffered: firstLate && piledIn,
    toolNames,
    text,
  }
}
