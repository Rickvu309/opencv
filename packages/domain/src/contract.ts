import type { z } from "zod"

type Schema = z.ZodType

type KeyedReplayReturnsFirstResult = "keyed"
type NoKeyBecauseWriteIsReplaySafe = "none"
export type IdempotencyPolicy =
  KeyedReplayReturnsFirstResult | NoKeyBecauseWriteIsReplaySafe

type QueryEntry<I extends Schema = Schema, O extends Schema = Schema> = {
  input: I
  output: O
}

export function queryContract<const T extends Record<string, QueryEntry>>(
  queries: T
) {
  return queries
}
