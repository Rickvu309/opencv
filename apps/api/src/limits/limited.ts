import { LIMITS, type LimitId } from "@workspace/domain/limits"
import type { Context, MiddlewareHandler } from "hono"

import { LEDGERS } from "./adapters.js"
import { systemClock, type Clock } from "./clock.js"
import type { LimitKey } from "./key.js"
import type { Ledger } from "./ledger.js"
import { Limited, refusalResponse } from "./refusal.js"
import { runLimit } from "./run.js"

type KeySource = {
  var: { userId: string }
  req: { param: (name: string) => string; raw: Request }
}

export function limited(
  id: LimitId,
  keyOf: (c: KeySource) => LimitKey | Promise<LimitKey>,
  ledger: Ledger = LEDGERS[id],
  clock: Clock = systemClock()
): MiddlewareHandler {
  return async (c: Context, next) => {
    const maybe = keyOf(c as unknown as KeySource)
    const key = maybe instanceof Promise ? await maybe : maybe
    try {
      return await runLimit({
        ledger,
        spec: LIMITS[id],
        id,
        key,
        clock,
        signal: c.req.raw.signal,
        job: async () => {
          await next()
          return c.res
        },
      })
    } catch (error) {
      if (error instanceof Limited) return refusalResponse(error.refusal)
      throw error
    }
  }
}
