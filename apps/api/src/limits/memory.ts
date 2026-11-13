import type { LimitSpec } from "@workspace/domain"

import type { Clock } from "./clock.js"
import type { LimitKey } from "./key.js"
import type { Ledger } from "./ledger.js"

export function memoryLedger(
  spec: LimitSpec,
  clock: Clock
): Ledger & { peek(): { keys: number; units: number } } {
  void clock
  if (spec.shape.kind !== "lease")
    throw new Error("The memory ledger in this version only runs a lease.")
  const shape = spec.shape
  const retryMs = spec.retryAfterSeconds * 1000
  const holders = new Map<string, number>()
  let units = 0
  return {
    enter(key: LimitKey, at: number) {
      const mine = holders.get(key) ?? 0
      if (mine >= shape.perKey)
        return {
          granted: false as const,
          reach: "key" as const,
          retryAt: at + retryMs,
        }
      if (units >= shape.total)
        return {
          granted: false as const,
          reach: "service" as const,
          retryAt: at + retryMs,
        }
      holders.set(key, mine + 1)
      units += 1
      let open = true
      return {
        granted: true as const,
        release() {
          if (!open) return Promise.resolve()
          open = false
          const left = (holders.get(key) ?? 1) - 1
          if (left <= 0) holders.delete(key)
          else holders.set(key, left)
          units -= 1
          return Promise.resolve()
        },
      }
    },
    held() {
      return Promise.resolve({ keys: holders.size, units })
    },
    peek() {
      return { keys: holders.size, units }
    },
  }
}
