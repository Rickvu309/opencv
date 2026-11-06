import {
  defineQuery,
  queries,
  type ActivityDraft,
  type Actor,
  type AnyCommandEntry,
  type CommandContract,
  type CommandInput,
  type CommandOutput,
  type CommandSpec,
  type QueryInput,
  type QueryName,
  type QueryOutput,
  type ReversalCall,
} from "@workspace/domain"
import type { ZodType } from "zod"

import type { ReversalExpectPending } from "./expect-pending.js"
import type { Registry } from "./registry.js"

type AtLeastOne<T> = {
  [K in keyof T]-?: Required<Pick<T, K>> & Partial<T>
}[keyof T]

export type ReversalGuard = {
  [Q in QueryName]: {
    query: Q
    input: QueryInput<Q>
    matches: AtLeastOne<QueryOutput<Q>>
    skipped: string
  }
}[QueryName]

export type GuardedReversal<C extends CommandContract> = ReversalCall<C> & {
  expect: ReversalGuard
}

type ReversalOf<
  C extends CommandContract,
  N extends keyof C & string,
> = N extends ReversalExpectPending
  ? ReversalCall<C> | null
  : GuardedReversal<C> | null

type Binding<C extends CommandContract, N extends keyof C & string> = {
  handler: (
    input: CommandInput<C, N>,
    actor: Actor
  ) => Promise<CommandOutput<C, N>>
  reversal: (
    input: CommandInput<C, N>,
    output: CommandOutput<C, N>
  ) => ReversalOf<C, N>
  activity: (
    input: CommandInput<C, N>,
    output: CommandOutput<C, N>,
    actor: Actor
  ) => ActivityDraft | null
  transaction?: "none"
}

export type Bindings<C extends CommandContract> = {
  [N in keyof C & string]: Binding<C, N>
}

type LooseBinding = {
  handler: (input: unknown, actor: Actor) => Promise<unknown>
  reversal: CommandSpec<unknown, unknown>["reversal"]
  activity: CommandSpec<unknown, unknown>["activity"]
  transaction?: "none"
}

export function bindCommands<C extends CommandContract>(
  registry: Registry,
  contract: C,
  bindings: Bindings<C>
) {
  for (const name of Object.keys(contract) as (keyof C & string)[]) {
    const entry: AnyCommandEntry = contract[name]
    const bound = bindings[name] as unknown as LooseBinding
    registry.addCommand<unknown, unknown>(
      {
        name,
        description: entry.description,
        input: entry.input,
        coach: entry.coach,
        delegate: entry.delegate,
        writes: entry.writes,
        destructive: entry.destructive,
        ...(entry.idempotency ? { idempotency: entry.idempotency } : {}),
        step: entry.step,
        reversal: bound.reversal,
        activity: bound.activity,
        ...(bound.transaction ? { transaction: bound.transaction } : {}),
      },
      bound.handler
    )
  }
}

type TableQuerySpec<N extends QueryName> = {
  description: string
  coach: boolean
  delegate?: "jobRead"
  step: (input: QueryInput<N>) => string
  read: (input: QueryInput<N>, actor: Actor) => Promise<QueryOutput<N>>
}

export function tableQuery<N extends QueryName>(
  name: N,
  spec: TableQuerySpec<N>
) {
  return defineQuery({
    name,
    ...spec,
    input: queries[name].input as unknown as ZodType<QueryInput<N>>,
  })
}
