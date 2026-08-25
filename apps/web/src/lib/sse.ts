export type SseEvent = {
  event: string
  data: unknown
}

/**
 * Parse one SSE block (the text between blank-line delimiters). Heartbeats
 * and comment-only blocks are skipped. `data:` lines are JSON when possible.
 */
export function parseSseBlock(block: string): SseEvent | null {
  const lines = block.split(/\r?\n/)
  if (lines.every((line) => line.length === 0 || line.startsWith(":"))) {
    return null
  }

  let event = "message"
  const dataLines: string[] = []
  for (const line of lines) {
    if (line.length === 0 || line.startsWith(":")) continue
    if (line.startsWith("event:")) {
      event = line.slice("event:".length).trim()
    } else if (line.startsWith("data:")) {
      dataLines.push(line.slice("data:".length).trimStart())
    }
  }
  if (dataLines.length === 0) return null

  const raw = dataLines.join("\n")
  try {
    return { event, data: JSON.parse(raw) as unknown }
  } catch {
    return { event, data: raw }
  }
}

/** Pull complete SSE events off the front of a buffer; leave a partial block. */
export function consumeSseBuffer(buffer: string): {
  events: SseEvent[]
  rest: string
} {
  const events: SseEvent[] = []
  const delimiter = /\r?\n\r?\n/
  let remaining = buffer

  while (true) {
    const match = delimiter.exec(remaining)
    if (!match) break
    const block = remaining.slice(0, match.index)
    remaining = remaining.slice(match.index + match[0].length)
    const event = parseSseBlock(block)
    if (event) events.push(event)
  }

  return { events, rest: remaining }
}

export function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError"
}

/**
 * Incrementally parse a byte stream as SSE. Honors `signal` so Stop can
 * tear the reader down without waiting for the next chunk.
 */
export async function* readSseStream(
  body: ReadableStream<Uint8Array>,
  options?: { signal?: AbortSignal }
): AsyncGenerator<SseEvent> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""

  const throwIfAborted = () => {
    if (options?.signal?.aborted) {
      throw new DOMException("Aborted", "AbortError")
    }
  }

  try {
    while (true) {
      throwIfAborted()
      const { done, value } = await reader.read()
      throwIfAborted()

      if (done) {
        buffer += decoder.decode()
        const { events, rest } = consumeSseBuffer(buffer)
        for (const event of events) yield event
        const last = rest.trim() ? parseSseBlock(rest) : null
        if (last) yield last
        return
      }

      buffer += decoder.decode(value, { stream: true })
      const consumed = consumeSseBuffer(buffer)
      buffer = consumed.rest
      for (const event of consumed.events) yield event
    }
  } finally {
    reader.releaseLock()
  }
}
