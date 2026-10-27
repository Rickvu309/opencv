import type { z } from "zod"

import type { QueryRef } from "./queries.js"

export type CoachPolicy =
  | { coach: "auto"; destructive: false }
  | { coach: "confirm" | "never"; destructive: boolean }

type Schema = z.ZodType

/**
 * "keyed" stores a client key so a replay returns the first result. "none" is for a
 * write that is already replay-safe (a version compare, a set to a value, a terminal
 * delete) or whose side effect precedes the key (a sent code); no key is sent or stored.
 */
export type IdempotencyPolicy = "keyed" | "none"

export type QueryEntry<I extends Schema = Schema, O extends Schema = Schema> = {
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

export type CommandEntry<
  I extends Schema = Schema,
  O extends Schema = Schema,
> = CoachPolicy & {
  description: string
  input: I
  output: O
  idempotency?: IdempotencyPolicy
  step: (input: z.output<I>) => string
  invalidates: (input: z.output<I>) => QueryRef[]
}

export function commandEntry<I extends Schema, O extends Schema>(
  entry: CommandEntry<I, O>
) {
  return entry
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyCommandEntry = CommandEntry<any, any>

export function commandContract<
  const T extends Record<string, AnyCommandEntry>,
>(commands: T) {
  return commands
}

export type CommandContract = Record<string, AnyCommandEntry>

export type CommandInput<
  C extends CommandContract,
  N extends keyof C,
> = z.output<C[N]["input"]>

export type CommandOutput<
  C extends CommandContract,
  N extends keyof C,
> = z.output<C[N]["output"]>

export type ReversalCall<C extends CommandContract> = {
  [N in keyof C & string]: { command: N; input: CommandInput<C, N> }
}[keyof C & string]
