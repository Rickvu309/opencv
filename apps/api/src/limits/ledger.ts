import type { LimitKey } from "./key.js"

export type Ledger = {
  enter(
    key: LimitKey,
    at: number
  ):
    | Promise<
        | { granted: true; release: () => Promise<void> }
        | { granted: false; reach: "key" | "service"; retryAt: number }
      >
    | { granted: true; release: () => Promise<void> }
    | { granted: false; reach: "key" | "service"; retryAt: number }
  held(): Promise<{ keys: number; units: number }>
}
