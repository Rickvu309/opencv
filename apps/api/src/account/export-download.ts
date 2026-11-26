import { LIMITS } from "@workspace/domain/limits"

import { currentLimit, expiredResponse } from "../limits/index.js"

const spec = LIMITS["export.running"]
const CONNECTION_CLOSED = "The export stopped because the connection closed."
const STREAM_PIECE = 16 * 1024

export type ExportArchive = { chunks: Buffer[]; byteLength: number }

export function exportDownload(
  archive: ExportArchive,
  clientGone?: AbortSignal
) {
  const active = currentLimit()
  if (!active) throw new Error("An export download needs a limit.")
  if (active.expired() || active.signal.aborted) {
    archive.chunks.length = 0
    active.settle()
    return expiredResponse("export.running")
  }
  if (clientGone?.aborted) {
    archive.chunks.length = 0
    active.settle()
    return new Response(null, {
      status: 499,
      headers: { "cache-control": "no-store" },
    })
  }
  let closed = false
  const fail = (
    controller: ReadableStreamDefaultController<Uint8Array>,
    message: string
  ) => {
    if (closed) return
    closed = true
    archive.chunks.length = 0
    try {
      controller.error(new Error(message))
    } catch {
      closed = true
    }
    active.settle()
  }
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      active.signal.addEventListener("abort", () => {
        fail(
          controller,
          spec.says.expired ??
            "The export took too long and was stopped. Try again."
        )
      })
      clientGone?.addEventListener("abort", () => {
        fail(controller, CONNECTION_CLOSED)
      })
    },
    pull(controller) {
      if (closed) return
      while (archive.chunks[0]?.byteLength === 0) archive.chunks.shift()
      const chunk = archive.chunks[0]
      if (!chunk) {
        closed = true
        try {
          controller.close()
        } catch {
          closed = true
        }
        active.settle()
        return
      }
      const size = Math.min(chunk.byteLength, STREAM_PIECE)
      const piece = chunk.subarray(0, size)
      if (size === chunk.byteLength) archive.chunks.shift()
      else archive.chunks[0] = chunk.subarray(size)
      controller.enqueue(
        new Uint8Array(piece.buffer, piece.byteOffset, piece.byteLength)
      )
    },
    cancel() {
      if (closed) return
      closed = true
      archive.chunks.length = 0
      active.settle()
    },
  })
  return new Response(body, {
    status: 200,
    headers: {
      "content-type": "application/zip",
      "content-length": String(archive.byteLength),
      "content-disposition": 'attachment; filename="opencv-export.zip"',
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
    },
  })
}
