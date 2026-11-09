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
  type ResourceRef,
} from "@workspace/domain"
import type { ZodType } from "zod"

import {
  REVERSAL_EXPECT_PENDING,
  type ReversalExpectPending,
} from "./expect-pending.js"
import type { Registry } from "./registry.js"
import {
  isUnchanged,
  type LockedBasis,
  type ReviewedCommand,
} from "./frozen-review.js"

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
  writes?: (input: CommandInput<C, N>) => ResourceRef[]
  transaction?: "none"
}

export type Bindings<C extends CommandContract> = {
  [N in keyof C & string]: Binding<C, N>
}

type LooseBinding = {
  handler: (input: unknown, actor: Actor) => Promise<unknown>
  reversal: CommandSpec<unknown, unknown>["reversal"]
  activity: CommandSpec<unknown, unknown>["activity"]
  writes?: (input: unknown) => ResourceRef[]
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
        writes: bound.writes ?? entry.writes,
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

export type OperationBinding<
  T extends Operation,
  R = unknown,
  C = never,
  V = never,
  S = never,
> = {
  operation: T
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
} & (
  | {
      execute: (
        input: import("zod").output<T["input"]>,
        actor: Actor
      ) => Promise<R> | R
      reviewed?: never
      selected?: never
    }
  | (T["kind"] extends "read"
      ? never
      : {
          execute?: never
          selected?: never
          reviewed: ReviewedCommand<
            import("zod").output<T["input"]>,
            R,
            C,
            V,
            S
          >
        })
  | (T["kind"] extends "read"
      ? never
      : {
          execute?: never
          reviewed?: never
          selected: {
            select: (
              input: Readonly<import("zod").output<T["input"]>>
            ) => "execute" | "reviewed"
            execute: (
              input: import("zod").output<T["input"]>,
              actor: Actor
            ) => Promise<R> | R
            reviewed: ReviewedCommand<
              import("zod").output<T["input"]>,
              R,
              C,
              V,
              S
            >
          }
        })
)

export function bindOperation<T extends Operation, R, C, V, S = never>(
  registry: Registry,
  suppliedBinding: OperationBinding<T, R, C, V, S>
) {
  const operation = suppliedBinding.operation
  const inputSchema = operation.input as ZodType<
    import("zod").output<T["input"]>
  >
  if (operation.kind === "read") {
    const execute = suppliedBinding.execute
    if (!execute) throw new Error("Reads require an execute binding")
    const binding = { execute }
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
    const binding = suppliedBinding
    const spec: import("@workspace/domain").CommandSpec<
      import("zod").output<T["input"]>,
      R
    > = {
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
    }
    const check = (result: R) => {
      const checked = binding.privateResult
        ? binding.privateResult.parse(result)
        : result
      operation.publicResult.parse(checked)
      return checked
    }
    const reviewed = binding.reviewed ?? binding.selected?.reviewed
    if (reviewed) {
      const checkedReview: ReviewedCommand<
        import("zod").output<T["input"]>,
        R,
        C,
        V,
        S
      > = {
        ...reviewed,
        prepare: async (input, actor) => {
          const prepared = await reviewed.prepare(input, actor)
          return isUnchanged(prepared)
            ? { ...prepared, output: check(prepared.output) }
            : prepared
        },
        commit: async (input, prepared, actor, locked) =>
          check(await reviewed.commit(input, prepared, actor, locked)),
      }
      const selected = binding.selected
      if (selected)
        registry.addSelectedCommand(spec, {
          select: selected.select,
          execute: async (input, actor) =>
            check(await selected.execute(input, actor)),
          reviewed: checkedReview,
        })
      else registry.addReviewedCommand(spec, checkedReview)
    } else
      registry.addCommand(spec, async (input, actor) => {
        const result = await binding.execute!(input, actor)
        const checked = binding.privateResult
          ? binding.privateResult.parse(result)
          : result
        operation.publicResult.parse(checked)
        return checked
      })
  }
  registry.adopt(operation)
}

type CatalogImplementations<C extends Record<string, Operation>> = {
  [N in keyof C]: { operation: C[N] } & (C[N]["kind"] extends "read"
    ? { execute: CatalogImplementation<C[N]> }
    : | { execute: CatalogImplementation<C[N]> }
      | {
          reviewed: {
            commit: (
              input: import("zod").output<C[N]["input"]>,
              prepared: never,
              context: never,
              locked: LockedBasis
            ) =>
              | import("zod").input<C[N]["publicResult"]>
              | Promise<import("zod").input<C[N]["publicResult"]>>
          }
        }
      | {
          selected: {
            execute: CatalogImplementation<C[N]>
            reviewed: {
              commit: (
                input: import("zod").output<C[N]["input"]>,
                prepared: never,
                context: never,
                locked: LockedBasis
              ) =>
                | import("zod").input<C[N]["publicResult"]>
                | Promise<import("zod").input<C[N]["publicResult"]>>
            }
          }
        })
}

type CatalogImplementation<T extends Operation> = (
  input: import("zod").output<T["input"]>,
  context: never
) =>
  | import("zod").input<T["publicResult"]>
  | Promise<import("zod").input<T["publicResult"]>>

export function bindCatalog<B extends Record<string, { operation: Operation }>>(
  registry: Registry,
  bindings: B &
    CatalogImplementations<{
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
