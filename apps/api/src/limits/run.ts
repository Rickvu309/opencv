import { AsyncLocalStorage } from "node:async_hooks"

import type { LimitId, LimitSpec } from "@workspace/domain"

import type { Clock } from "./clock.js"
import type { LimitKey } from "./key.js"
import type { Ledger } from "./ledger.js"
import { Limited, toRefusal } from "./refusal.js"

export type ActiveLimit = {
  signal: AbortSignal
  expired: () => boolean
  settle: () => void
}

const activeLimit = new AsyncLocalStorage<ActiveLimit>()

export function currentLimit() {
  return activeLimit.getStore() ?? null
}

function keepsTheSlot(value: unknown) {
  return (
    value instanceof Response && value.status === 200 && value.body !== null
  )
}

export async function runLimit<T>(args: {
  ledger: Ledger
  spec: LimitSpec
  id: LimitId
  key: LimitKey
  clock: Clock
  signal: AbortSignal | undefined
  job: (signal: AbortSignal) => Promise<T>
}): Promise<T> {
  const { ledger, spec, id, key, clock, signal, job } = args
  if (signal?.aborted)
    throw new Error("The limit was aborted before it started.")
  const now = clock.now()
  const pending = ledger.enter(key, now)
  const grant = pending instanceof Promise ? await pending : pending
  if (!grant.granted) throw new Limited(toRefusal(id, spec, grant, now))
  const hold = new AbortController()
  let expired = false
  let settled = false
  let jobDone = false
  let cancelTimer = () => {}
  const settle = () => {
    if (settled) return
    settled = true
    cancelTimer()
    signal?.removeEventListener("abort", onClientAbort)
    void grant.release()
  }
  function onClientAbort() {
    if (!jobDone) return
    settle()
  }
  signal?.addEventListener("abort", onClientAbort)
  if (spec.shape.kind === "lease") {
    cancelTimer = clock.at(spec.shape.holdMs, () => {
      expired = true
      hold.abort()
      settle()
    })
  }
  const active: ActiveLimit = {
    signal: hold.signal,
    expired: () => expired,
    settle,
  }
  try {
    const value = await activeLimit.run(active, () => job(hold.signal))
    jobDone = true
    if (!keepsTheSlot(value) || signal?.aborted || expired) settle()
    return value
  } catch (error) {
    jobDone = true
    settle()
    throw error
  }
}
