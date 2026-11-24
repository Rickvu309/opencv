import {
  defineQuery,
  delegateDeclaration,
  type DelegateMarker,
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
import type { ProposalBasis } from "./registry-types.js"
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

type GuardedPlan = NonNullable<ReversalPlan> & { expect: ReversalExpect }

export type IrreversibleCommand = { irreversible: string }
export type SilentCommand = { silent: string }

function statesReason(value: unknown, key: "irreversible" | "silent") {
  if (typeof value !== "object" || value === null || !(key in value))
    return false
  const reason = (value as Record<string, unknown>)[key]
  return typeof reason === "string" && /\S\s+\S/.test(reason)
}

export function requireStatedBinding(
  name: string,
  binding: { reversal?: unknown; activity?: unknown }
) {
  if (
    typeof binding.reversal !== "function" &&
    !statesReason(binding.reversal, "irreversible")
  )
    throw new Error(
      `Command ${name} needs an Undo or { irreversible: "<reason>" }`
    )
  if (
    typeof binding.activity !== "function" &&
    !statesReason(binding.activity, "silent")
  )
    throw new Error(
      `Command ${name} needs an activity receipt or { silent: "<reason>" }`
    )
}

type ReversalBinding<I, R> =
  | ((input: I, result: R) => GuardedPlan | IrreversibleCommand)
  | IrreversibleCommand

type ActivityBinding<I, R> =
  ((input: I, result: R, actor: Actor) => ActivityDraft) | SilentCommand

function boundReversal<I, R>(
  reversal: ReversalBinding<I, R> | undefined
): (input: I, result: R) => ReversalPlan {
  if (typeof reversal !== "function") return () => null
  return (input, result) => {
    const plan = reversal(input, result)
    return "irreversible" in plan ? null : plan
  }
}

function withBasis<S extends object, I>(
  spec: S,
  basis: ProposalBasis<I> | undefined
) {
  return basis ? { ...spec, basis } : spec
}

function boundActivity<I, R>(
  activity: ActivityBinding<I, R> | undefined
): (input: I, result: R, actor: Actor) => ActivityDraft | null {
  if (typeof activity !== "function") return () => null
  return activity
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
  basis?: ProposalBasis<CommandInput<C, N>>
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
  basis?: ProposalBasis<unknown>
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
        ...(bound.basis ? { basis: bound.basis } : {}),
      },
      bound.handler
    )
  }
}

type TableQuerySpec<N extends QueryName> = {
  description: string
  coach: boolean
  delegate?: DelegateMarker
  step: (input: QueryInput<N>) => string
  read: (input: QueryInput<N>, actor: Actor) => Promise<QueryOutput<N>>
  visitor?: (input: QueryInput<N>) => Promise<QueryOutput<N>>
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
} & (T["kind"] extends "command"
  ? {
      reversal: ReversalBinding<import("zod").output<T["input"]>, R>
      activity: ActivityBinding<import("zod").output<T["input"]>, R>
      basis?: ProposalBasis<import("zod").output<T["input"]>>
      transaction?: "none"
    }
  : {
      reversal?: never
      activity?: never
      basis?: never
      transaction?: never
    }) &
  (
    | {
        execute: T["kind"] extends "read"
          ? (
              input: import("zod").output<T["input"]>,
              actor: Actor
            ) => Promise<R> | R
          : (
              input: import("zod").output<T["input"]>,
              actor: Actor,
              registry: Registry
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
    const binding = {
      execute: execute as (
        input: import("zod").output<T["input"]>,
        actor: Actor
      ) => Promise<R> | R,
    }
    registry.addQuery({
      name: operation.name,
      description: operation.description,
      input: inputSchema,
      coach: operation.coach !== "never",
      ...(delegateDeclaration(operation.delegate)
        ? { delegate: operation.delegate }
        : {}),
      step: () => operation.description,
      read: async (input, actor) =>
        operation.publicResult.parse(await binding.execute(input, actor)),
    })
  } else {
    const binding = suppliedBinding
    requireStatedBinding(operation.name, binding)
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
      ...(delegateDeclaration(operation.delegate)
        ? { delegate: operation.delegate }
        : {}),
      writes: (input) => [...operation.writes(input as never)],
      ...(binding.transaction ? { transaction: binding.transaction } : {}),
      step: () => operation.description,
      reversal: boundReversal(
        binding.reversal as
          ReversalBinding<import("zod").output<T["input"]>, R> | undefined
      ),
      activity: boundActivity(
        binding.activity as
          ActivityBinding<import("zod").output<T["input"]>, R> | undefined
      ),
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
      registry.addCommand(
        withBasis(spec, binding.basis),
        async (input, actor) => {
          const result = await binding.execute!(input, actor, registry)
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
  context: never,
  registry: never
) =>
  | import("zod").input<T["publicResult"]>
  | Promise<import("zod").input<T["publicResult"]>>

export function bindCatalog<B extends Record<string, { operation: Operation }>>(
  registry: Registry,
  bindings: B &
    CatalogImplementations<{
      [N in keyof B]: B[N]["operation"]
    }> & {
      [N in keyof B]: B[N]["operation"]["kind"] extends "command"
        ? {
            reversal:
              | ((...args: never[]) => GuardedPlan | IrreversibleCommand)
              | IrreversibleCommand
            activity: ((...args: never[]) => ActivityDraft) | SilentCommand
          }
        : { reversal?: never; activity?: never }
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
}
