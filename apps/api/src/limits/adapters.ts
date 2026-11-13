import { LIMITS, type LimitId, type LimitShape } from "@workspace/domain"

import type { Clock } from "./clock.js"
import { systemClock } from "./clock.js"
import type { Ledger } from "./ledger.js"
import { memoryLedger } from "./memory.js"

export function counterLedger(
  shape: LimitShape,
  db: unknown,
  clock: Clock
): Ledger {
  void db
  void clock
  if (shape.kind !== "window")
    throw new Error("A counter ledger counts a window.")
  return {
    enter() {
      return Promise.reject(new Error("Window limits have not moved yet."))
    },
    held: () => Promise.resolve({ keys: 0, units: 0 }),
  }
}

export function heldRowsLedger(
  shape: LimitShape,
  countHeld: (key: string) => Promise<number>
): Ledger {
  void countHeld
  if (shape.kind !== "held-rows")
    throw new Error("A held-rows ledger counts rows the owner already stores.")
  return {
    enter() {
      return Promise.reject(new Error("Held-row limits have not moved yet."))
    },
    held: () => Promise.resolve({ keys: 0, units: 0 }),
  }
}

export const LEDGERS: Record<LimitId, Ledger> = {
  "export.running": memoryLedger(LIMITS["export.running"], systemClock()),
}
