import type { ThreadDetail } from "@workspace/domain"

import type {
  CoachScriptPart,
  CoachStreamScript,
  GateState,
  LastCoachRequest,
} from "./coach-stream-types.ts"
import { FIXTURE_THREADS } from "./thread-fixtures.ts"

export const DEFAULT_COACH_STREAM_TEXTS = [
  "I looked at Apply. ",
  "Prep the starred one next.",
] as const

export const DEFAULT_COACH_STREAM_REPLY = DEFAULT_COACH_STREAM_TEXTS.join("")

export const DEFAULT_COACH_WORKED_MS = 1100

export type NativeTurnRecord = {
  chatId: string
  text?: string
  attachments?: unknown
}

export type UsageOverride = {
  plan: "free" | "pro"
  mode: "free" | "light" | "max"
  caps: { free: number; light: number; max: number }
  day: {
    capped: boolean
    used?: number
    cap?: number
    remaining?: number
    resetsAt: string
  }
}

export function openGate(): GateState {
  return {
    permits: 0,
    waiters: [],
    releasedAll: true,
    emitted: 0,
  }
}

export function cloneThreads(threads: ThreadDetail[]): ThreadDetail[] {
  return structuredClone(threads)
}

export function defaultUsage(): UsageOverride {
  return {
    plan: "free",
    mode: "free",
    caps: { free: 20, light: 10, max: 5 },
    day: {
      capped: false,
      used: 0,
      cap: 20,
      remaining: 20,
      resetsAt: "2026-10-28T00:00:00.000Z",
    },
  }
}

export const mockState: {
  threads: ThreadDetail[]
  script: CoachStreamScript
  gate: GateState
  lastCoachRequest: LastCoachRequest | null
  nativeTurn: NativeTurnRecord | null
  commandCalls: Array<{ name: string; body: unknown }>
  usage: UsageOverride
  usageTouched: boolean
} = {
  threads: cloneThreads(FIXTURE_THREADS),
  script: {},
  gate: openGate(),
  lastCoachRequest: null,
  nativeTurn: null,
  commandCalls: [],
  usage: defaultUsage(),
  usageTouched: false,
}

export async function readBody(init?: RequestInit): Promise<unknown> {
  if (init?.body == null) return {}
  const text = String(init.body)
  if (text.trim() === "") return {}
  return JSON.parse(text) as unknown
}

export function formatSse(event: string, data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
}

export function scriptedParts(): CoachScriptPart[] {
  if (mockState.script.parts) return [...mockState.script.parts]
  return (mockState.script.texts ?? DEFAULT_COACH_STREAM_TEXTS).map((text) => ({
    kind: "text" as const,
    text,
  }))
}

export async function waitForPermit(signal?: AbortSignal) {
  if (mockState.gate.releasedAll) return
  if (mockState.gate.permits > 0) {
    mockState.gate.permits -= 1
    return
  }

  await new Promise<void>((resolve, reject) => {
    const onAbort = () => {
      reject(new DOMException("Aborted", "AbortError"))
    }
    if (signal?.aborted) {
      onAbort()
      return
    }
    signal?.addEventListener("abort", onAbort, { once: true })
    mockState.gate.waiters.push(() => {
      signal?.removeEventListener("abort", onAbort)
      resolve()
    })
  })
}

export async function waitDelay(ms: number, signal?: AbortSignal) {
  if (ms <= 0) return
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms)
    const onAbort = () => {
      clearTimeout(timer)
      reject(new DOMException("Aborted", "AbortError"))
    }
    if (signal?.aborted) {
      onAbort()
      return
    }
    signal?.addEventListener("abort", onAbort, { once: true })
  })
}
