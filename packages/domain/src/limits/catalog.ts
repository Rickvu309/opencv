export const SERVICE_MEMORY_BYTES = 256 * 1024 * 1024

export type LimitScope = "account" | "address" | "client" | "service"

export type LimitShape =
  | {
      kind: "lease"
      perKey: number
      total: number
      holdMs: number
      costBytes: number
    }
  | {
      kind: "queue"
      workers: number
      waiting: number
      perKeyWaiting: number
      waitMs: number
      budgetMs: number
      windowMs: number
      fairStepMs: number
    }
  | { kind: "window"; windows: readonly { ms: number; max: number }[] }
  | { kind: "pool"; size: number; protectedMs: number }
  | { kind: "held-rows"; perKey: number; bytesPerKey: number | null }

export type LimitSpec = {
  scope: LimitScope
  shape: LimitShape
  says: { key: string; service: string | null; expired: string | null }
  retryAfterSeconds: number
  honest: { uses: number; perMs: number }
  accepts: {
    oneKeyShare: number
    keysToDenyAll: number
    targetedDenialMs: number
  }
}

function defineLimits<const T extends Record<string, LimitSpec>>(specs: T): T {
  for (const [id, spec] of Object.entries(specs)) {
    if (spec.retryAfterSeconds < 1)
      throw new Error(`${id} must tell a person to wait at least one second`)
    if (spec.accepts.oneKeyShare <= 0 || spec.accepts.oneKeyShare > 1)
      throw new Error(`${id} share must be a fraction of capacity`)
    if (spec.accepts.keysToDenyAll < 1)
      throw new Error(`${id} needs at least one key to fill the service`)
    if (spec.shape.kind === "lease") {
      if (spec.shape.perKey < 1 || spec.shape.total < spec.shape.perKey)
        throw new Error(`${id} lease cannot be granted`)
      if (spec.shape.holdMs < 1) throw new Error(`${id} lease needs a hold`)
      if (spec.shape.total * spec.shape.costBytes > SERVICE_MEMORY_BYTES)
        throw new Error(`${id} lease exceeds the service memory budget`)
    }
  }
  return specs
}

export const LIMITS = defineLimits({
  "export.running": {
    scope: "account",
    shape: {
      kind: "lease",
      perKey: 1,
      total: 2,
      holdMs: 15 * 60_000,
      costBytes: 64 * 1024 * 1024,
    },
    says: {
      key: "An export is already being prepared. Try again when it finishes.",
      service:
        "Other exports are being prepared right now. Try again in a minute.",
      expired: "The export took too long and was stopped. Try again.",
    },
    retryAfterSeconds: 30,
    honest: { uses: 2, perMs: 60_000 },
    accepts: { oneKeyShare: 0.5, keysToDenyAll: 2, targetedDenialMs: 0 },
  },
})

export type LimitId = keyof typeof LIMITS
