import { errorEnvelope } from "@workspace/domain"

export const EXPORTS_AT_ONCE = 2
export const EXPORT_TIME_LIMIT_MS = 15 * 60_000
export const EXPORT_RETRY_AFTER_SECONDS = 30
export const EXPORT_ACCOUNT_BUSY =
  "An export is already being prepared. Try again when it finishes."
export const EXPORT_SERVICE_BUSY =
  "Other exports are being prepared right now. Try again in a minute."
export const EXPORT_TIMED_OUT =
  "The export took too long and was stopped. Try again."

export type ExportArchive = { chunks: Buffer[]; byteLength: number }

export type ExportClaim =
  | { kind: "granted"; release: () => void }
  | { kind: "account-busy" }
  | { kind: "service-busy" }

export type ExportGate = {
  claim: (owner: string) => ExportClaim
  running: () => number
}

export function createExportGate(ceiling = EXPORTS_AT_ONCE): ExportGate {
  const owners = new Set<string>()
  return {
    claim(owner) {
      if (owners.has(owner)) return { kind: "account-busy" }
      if (owners.size >= ceiling) return { kind: "service-busy" }
      owners.add(owner)
      let held = true
      return {
        kind: "granted",
        release() {
          if (!held) return
          held = false
          owners.delete(owner)
        },
      }
    },
    running: () => owners.size,
  }
}

function refusal(status: 429 | 503, message: string) {
  const seconds = String(EXPORT_RETRY_AFTER_SECONDS)
  return new Response(
    JSON.stringify(
      errorEnvelope(
        status === 429 ? "EXPORT_IN_PROGRESS" : "EXPORT_BUSY",
        message
      )
    ),
    {
      status,
      headers: {
        "content-type": "application/json",
        "retry-after": seconds,
        "cache-control": "no-store",
      },
    }
  )
}

function archiveStream(
  archive: ExportArchive,
  finish: () => void,
  stopOnTimeOut: (stop: () => void) => void
) {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      stopOnTimeOut(() => {
        archive.chunks.length = 0
        controller.error(new Error(EXPORT_TIMED_OUT))
      })
    },
    pull(controller) {
      const chunk = archive.chunks.shift()
      if (chunk) {
        controller.enqueue(
          new Uint8Array(chunk.buffer, chunk.byteOffset, chunk.byteLength)
        )
        return
      }
      controller.close()
      finish()
    },
    cancel() {
      archive.chunks.length = 0
      finish()
    },
  })
}

export async function gatedExport(
  gate: ExportGate,
  owner: string,
  build: () => Promise<ExportArchive>,
  timeLimitMs = EXPORT_TIME_LIMIT_MS
): Promise<Response> {
  const claim = gate.claim(owner)
  if (claim.kind === "account-busy") return refusal(429, EXPORT_ACCOUNT_BUSY)
  if (claim.kind === "service-busy") return refusal(503, EXPORT_SERVICE_BUSY)
  let expired = false
  let stopStream = () => {}
  const timer = setTimeout(() => {
    expired = true
    stopStream()
    claim.release()
  }, timeLimitMs)
  timer.unref?.()
  const finish = () => {
    clearTimeout(timer)
    claim.release()
  }
  let archive: ExportArchive
  try {
    archive = await build()
  } catch (error) {
    finish()
    throw error
  }
  if (expired) {
    archive.chunks.length = 0
    finish()
    return refusal(503, EXPORT_TIMED_OUT)
  }
  const body = archiveStream(archive, finish, (stop) => {
    stopStream = stop
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
