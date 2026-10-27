import {
  encodeChatTurnEvent,
  type ChatTurnEvent,
  type CoachStreamPart,
} from "@workspace/domain"
import type { SSEStreamingApi } from "hono/streaming"

export function isDisconnected(stream: SSEStreamingApi, signal?: AbortSignal) {
  return stream.aborted || Boolean(signal?.aborted)
}

export function waitForAbort(stream: SSEStreamingApi, signal?: AbortSignal) {
  let settled = false
  let resolve = () => {}
  const promise = new Promise<void>((r) => {
    resolve = r
  })

  const settle = () => {
    if (settled) return
    settled = true
    resolve()
  }

  stream.onAbort(settle)
  signal?.addEventListener("abort", settle, { once: true })
  if (isDisconnected(stream, signal)) settle()

  return {
    promise,
    dispose() {
      signal?.removeEventListener("abort", settle)
      settle()
    },
  }
}

export async function* takeUntilAbort<T>(
  iterable: AsyncIterable<T>,
  abort: Promise<void>,
  isAborted: () => boolean
): AsyncGenerator<T> {
  const iterator = iterable[Symbol.asyncIterator]()
  try {
    while (!isAborted()) {
      const outcome = await Promise.race([
        iterator.next().then((value) => ({ kind: "next" as const, value })),
        abort.then(() => ({ kind: "abort" as const })),
      ])
      if (outcome.kind === "abort" || isAborted()) return
      if (outcome.value.done) return
      yield outcome.value.value
    }
  } finally {
    void iterator.return?.()
  }
}

export async function writeChatEvent(
  stream: SSEStreamingApi,
  event: ChatTurnEvent
) {
  if (stream.aborted) return
  let wire: ReturnType<typeof encodeChatTurnEvent>
  try {
    wire = encodeChatTurnEvent(event)
  } catch (error) {
    console.error("Coach event broke the chat turn contract", event.type, error)
    wire = encodeChatTurnEvent({ type: "error", message: "The Coach stopped." })
  }
  try {
    await stream.writeSSE(wire)
  } catch {
    // Client gone — persistence still runs in finally.
  }
}

export async function writeHeartbeat(stream: SSEStreamingApi) {
  if (stream.aborted) return
  try {
    await stream.write(": heartbeat\n\n")
  } catch {
    // ignore
  }
}

export function eventForPart(part: CoachStreamPart): ChatTurnEvent | null {
  switch (part.type) {
    case "text-delta":
      return { type: "text-delta", text: part.text }
    case "tool-call":
      return {
        type: "tool-call",
        toolCallId: part.toolCallId,
        name: part.name,
        input: part.input,
      }
    case "tool-result":
      return {
        type: "tool-result",
        toolCallId: part.toolCallId,
        name: part.name,
        summary: part.summary,
        ok: part.ok,
        result: part.result,
        ...(part.reversal ? { reversal: part.reversal } : {}),
        ...(part.detail ? { detail: part.detail } : {}),
        ...(part.activityId ? { activityId: part.activityId } : {}),
      }
    default:
      return null
  }
}
