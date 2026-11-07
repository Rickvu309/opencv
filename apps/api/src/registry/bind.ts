import {
  defineQuery,
  type Operation,
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
  type ReversalPlan,
  type ReversalExpect,
} from "@workspace/domain"
import type { ZodType } from "zod"

import {
  REVERSAL_EXPECT_PENDING,
  type ReversalExpectPending,
} from "./expect-pending.js"
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

export type OperationBinding<T extends Operation, R = unknown> = {
  operation: T
  execute: (
    input: import("zod").output<T["input"]>,
    actor: Actor
  ) => Promise<R> | R
  privateResult?: ZodType<R>
  reversal?: (
    input: import("zod").output<T["input"]>,
    result: R
  ) => (NonNullable<ReversalPlan> & { expect: ReversalExpect }) | null
  activity?: (
    input: import("zod").output<T["input"]>,
    result: R,
    actor: Actor
  ) => ActivityDraft | null
}

export function bindOperation<T extends Operation, R>(
  registry: Registry,
  binding: OperationBinding<T, R>
) {
  const operation = binding.operation
  const inputSchema = operation.input as ZodType<
    import("zod").output<T["input"]>
  >
  if (operation.kind === "read") {
    registry.addQuery({
      name: operation.name,
      description: operation.description,
      input: inputSchema,
      coach: operation.coach !== "never",
      ...(operation.delegate === "jobRead"
        ? { delegate: operation.delegate }
        : {}),
      step: () => operation.description,
      read: async (input, actor) =>
        operation.publicResult.parse(await binding.execute(input, actor)),
    })
  } else {
    registry.addCommand<import("zod").output<T["input"]>, R>(
      {
        name: operation.name,
        description: operation.description,
        input: inputSchema,
        coach: operation.coach,
        destructive: operation.destructive,
        idempotency: operation.idempotency,
        ...(operation.delegate === "reversibleJob"
          ? { delegate: operation.delegate }
          : {}),
        writes: (input) => [...operation.writes(input as never)],
        step: () => operation.description,
        reversal: (input, result) => binding.reversal?.(input, result) ?? null,
        activity: (input, result, actor) =>
          binding.activity?.(input, result, actor) ?? null,
      },
      async (input, actor) => {
        const result = await binding.execute(input, actor)
        const checked = binding.privateResult
          ? binding.privateResult.parse(result)
          : result
        operation.publicResult.parse(checked)
        return checked
      }
    )
  }
  registry.adopt(operation)
}

export function bindCatalog<
  B extends Record<
    string,
    { operation: Operation; execute: (...args: never[]) => unknown }
  >,
>(
  registry: Registry,
  bindings: B &
    import("@workspace/domain").Implementations<{
      [N in keyof B]: B[N]["operation"]
    }> & {
      [N in keyof B]: {
        reversal?: (
          ...args: never[]
        ) => (NonNullable<ReversalPlan> & { expect: ReversalExpect }) | null
      }
    }
) {
  for (const [name, binding] of Object.entries(bindings)) {
    if (name !== binding.operation.name)
      throw new Error(`Catalog identity mismatch ${name}`)
    bindOperation(registry, binding as unknown as OperationBinding<Operation>)
  }
}

export function assertReversal(
  command: string,
  catalog: boolean,
  result: { reversal: ReversalPlan; draft: ActivityDraft | null }
) {
  if (
    result.reversal &&
    (!result.reversal.expect ||
      !Object.keys(result.reversal.expect.matches).length) &&
    (catalog ||
      !REVERSAL_EXPECT_PENDING.commands.some((name) => name === command))
  )
    throw new Error("Reversals require a guarded expectation")
  if (catalog && result.reversal && !result.draft)
    throw new Error("Catalog reversals require an activity receipt")
}
