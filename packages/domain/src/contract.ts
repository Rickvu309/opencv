import type { z } from "zod"

import type { CoachPolicy, DelegateMarker } from "./operation.js"
import type { QueryRef } from "./queries.js"
import type { ResourceRef } from "./resources.js"

type Schema = z.ZodType

type KeyedReplayReturnsFirstResult = "keyed"
type NoKeyBecauseWriteIsReplaySafe = "none"
export type IdempotencyPolicy =
  KeyedReplayReturnsFirstResult | NoKeyBecauseWriteIsReplaySafe

type QueryEntry<I extends Schema = Schema, O extends Schema = Schema> = {
  input: I
  output: O
}

export function queryEntry<I extends Schema, O extends Schema>(
  entry: QueryEntry<I, O>
) {
  return entry
}

export function queryContract<const T extends Record<string, QueryEntry>>(
  queries: T
) {
  return queries
}

type CommandEntry<
  I extends Schema = Schema,
  O extends Schema = Schema,
> = CoachPolicy & {
  delegate?: DelegateMarker
  description: string
  input: I
  output: O
  idempotency?: IdempotencyPolicy
  step: (input: z.output<I>) => string
  invalidates: (input: z.output<I>) => QueryRef[]
  writes?: (input: z.output<I>) => ResourceRef[]
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- the entry type erases each command's own input and output schemas
export type AnyCommandEntry = CommandEntry<any, any>

export function commandContract<
  const T extends Record<string, AnyCommandEntry>,
>(commands: T) {
  return commands
}
