import type { QueryClient } from "@tanstack/react-query"
import { changeSchema, type BlockId } from "@workspace/domain/paper-doc"
import { createEngine } from "@workspace/paper-engine"

import { ApiError, apiRequest } from "@/lib/api.ts"
import { catalogClient } from "@/lib/contract-client.ts"
import { indexedDbPendingStore } from "@/lib/paper-pending-store.ts"
import {
  RefusedSave,
  type SaveReply,
  type SyncPorts,
  type SyncTransport,
  type TabChannel,
  type TabMessage,
  type WriterClaim,
} from "@/lib/paper-sync.ts"
import { readSseStream } from "@/lib/sse.ts"

const RETRYABLE = new Set([401, 408, 409, 425, 429])

function refusedStatus(error: unknown) {
  return (
    error instanceof ApiError &&
    error.status >= 400 &&
    error.status < 500 &&
    !RETRYABLE.has(error.status)
  )
}

function randomId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("")
}

export function catalogTransport(queryClient: QueryClient): SyncTransport {
  return {
    head: (docId) => catalogClient.read("paper.head", { docId }),
    async save(input) {
      try {
        const reply = await catalogClient.run(
          queryClient,
          "paper.save",
          input,
          {
            refresh: false,
          }
        )
        if ("ok" in reply || "stale" in reply) return reply as SaveReply
        throw new RefusedSave("Paper save answered for another engine")
      } catch (error) {
        if (refusedStatus(error))
          throw new RefusedSave(
            error instanceof Error ? error.message : "Paper save refused"
          )
        throw error
      }
    },
    changes: (docId, since) =>
      catalogClient.read("paper.changes", { docId, since }),
    async follow(docId, since, onChange, signal) {
      const response = await apiRequest(
        `/api/paper/${docId}/changes?since=${since}`,
        { signal, headers: { Accept: "text/event-stream" } }
      )
      if (!response.body) throw new Error("Paper changes stream has no body")
      for await (const event of readSseStream(response.body, { signal })) {
        if (event.event === "reset") return "reset"
        if (event.event === "change") onChange(changeSchema.parse(event.data))
      }
      return "ended"
    },
  }
}

function tabChannel(docId: string): TabChannel | null {
  if (typeof BroadcastChannel === "undefined") return null
  const channel = new BroadcastChannel(`opencv-paper:${docId}`)
  return {
    post: (message) => channel.postMessage(message),
    listen(listener) {
      const receive = (event: MessageEvent<TabMessage>) => listener(event.data)
      channel.addEventListener("message", receive)
      return () => channel.removeEventListener("message", receive)
    },
    close: () => channel.close(),
  }
}

function holdLock(name: string): Promise<(() => void) | null> {
  return new Promise((resolve) => {
    void navigator.locks.request(name, { ifAvailable: true }, (lock) => {
      if (!lock) {
        resolve(null)
        return null
      }
      return new Promise<void>((release) => resolve(release))
    })
  })
}

const KEEP = () => undefined

function sessionWriter(key: string): string | null {
  try {
    return sessionStorage.getItem(key)
  } catch {
    return null
  }
}

function keepSessionWriter(key: string, writer: string) {
  try {
    sessionStorage.setItem(key, writer)
  } catch {
    return
  }
}

const pageClaims = new Map<string, Promise<void>>()

export async function claimTabWriter(
  docId: string,
  stored: readonly string[]
): Promise<WriterClaim> {
  const before = pageClaims.get(docId) ?? Promise.resolve()
  let released = () => undefined as void
  const mine = new Promise<void>((resolve) => {
    released = resolve
  })
  pageClaims.set(
    docId,
    before.then(() => mine)
  )
  await before
  const claim = await pickWriter(docId, stored)
  let done = false
  return {
    writer: claim.writer,
    release() {
      if (done) return
      done = true
      claim.release()
      released()
    },
  }
}

async function pickWriter(
  docId: string,
  stored: readonly string[]
): Promise<WriterClaim> {
  const key = `opencv-paper-writer:${docId}`
  const mine = sessionWriter(key)
  const locks = typeof navigator !== "undefined" && "locks" in navigator
  const candidates = [...new Set([mine, ...stored])].filter(
    (writer): writer is string => !!writer
  )
  const lockOf = (writer: string) => `opencv-paper-writer:${docId}:${writer}`
  if (!locks) {
    const writer = mine ?? `tab-${randomId()}`
    keepSessionWriter(key, writer)
    return { writer, release: KEEP }
  }
  for (const writer of candidates) {
    const release = await holdLock(lockOf(writer))
    if (release) {
      keepSessionWriter(key, writer)
      return { writer, release }
    }
  }
  const writer = `tab-${randomId()}`
  const release = (await holdLock(lockOf(writer))) ?? KEEP
  keepSessionWriter(key, writer)
  return { writer, release }
}

export function browserSyncPorts(
  docId: string,
  queryClient: QueryClient
): SyncPorts {
  return {
    engine: createEngine({
      ids: () => randomId() as BlockId,
      now: () => Date.now(),
    }),
    transport: catalogTransport(queryClient),
    store: indexedDbPendingStore(),
    channel: tabChannel(docId),
    later(ms, run) {
      const timer = setTimeout(run, ms)
      return () => clearTimeout(timer)
    },
    claimWriter: claimTabWriter,
    online: {
      now: () => navigator.onLine,
      listen(listener) {
        const up = () => listener(true)
        const down = () => listener(false)
        window.addEventListener("online", up)
        window.addEventListener("offline", down)
        return () => {
          window.removeEventListener("online", up)
          window.removeEventListener("offline", down)
        }
      },
    },
  }
}
