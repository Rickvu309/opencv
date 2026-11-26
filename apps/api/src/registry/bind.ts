import {
  delegateDeclaration,
  type Operation,
  type ActivityDraft,
  type Actor,
  type QueryInput,
  type QueryName,
  type QueryOutput,
  type ReversalPlan,
  type ReversalExpect,
} from "@workspace/domain/kernel"
import type { catalog } from "@workspace/domain/kernel"
import type { ZodType } from "zod"

import type { Registry } from "./registry.js"
import type { ProposalBasis } from "./registry-types.js"

type AtLeastOne<T> = T extends unknown
  ? { [K in keyof T]-?: Required<Pick<T, K>> & Partial<T> }[keyof T]
  : never

export type ReversalGuard = {
  [Q in QueryName]: {
    query: Q
    input: QueryInput<Q>
    matches: AtLeastOne<QueryOutput<Q>>
    skipped: string
  }
}[QueryName]

type CatalogReversalCall = {
  [N in keyof typeof catalog]: (typeof catalog)[N]["kind"] extends "command"
    ? {
        command: N
        input: import("zod").input<(typeof catalog)[N]["input"]>
      }
    : never
}[keyof typeof catalog]

declare const undoOnlyBrand: unique symbol

export type UndoOnlyPlan = GuardedPlan & { readonly [undoOnlyBrand]: true }

export function undoOnlyReversal(plan: GuardedPlan): UndoOnlyPlan {
  return plan as UndoOnlyPlan
}

type PairReversal<I, R, In, N extends string> =
  | ((
      input: I,
      result: R
    ) =>
      | GuardedPlan<In, N>
      | (CatalogReversalCall & { expect: ReversalExpect })
      | UndoOnlyPlan
      | IrreversibleCommand)
  | IrreversibleCommand

type GuardedPlan<In = unknown, N extends string = string> = Omit<
  NonNullable<ReversalPlan>,
  "command" | "input"
> & { command: N; input: In; expect: ReversalExpect }

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

type ReversalBinding<I, R, In = unknown, N extends string = string> =
  | ((input: I, result: R) => GuardedPlan<In, N> | IrreversibleCommand)
  | IrreversibleCommand

type ActivityBinding<I, R> =
  ((input: I, result: R, actor: Actor) => ActivityDraft | null) | SilentCommand

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

export type OperationBinding<T extends Operation, R = unknown> = {
  operation: T
  privateResult?: ZodType<R>
} & (T["kind"] extends "command"
  ? {
      reversal: PairReversal<
        import("zod").output<T["input"]>,
        R,
        import("zod").input<T["input"]>,
        T["name"]
      >
      activity: ActivityBinding<import("zod").output<T["input"]>, R>
      basis?: ProposalBasis<import("zod").output<T["input"]>>
      transaction?: "none"
      prepare?: (
        input: import("zod").output<T["input"]>,
        actor: Actor,
        registry: Registry
      ) => Promise<unknown>
    }
  : {
      reversal?: never
      activity?: never
      basis?: never
      transaction?: never
      prepare?: never
    }) & {
    execute: (
      input: import("zod").output<T["input"]>,
      actor: Actor,
      registry: Registry,
      ahead?: unknown
    ) => Promise<R> | R
  }

export function bindOperation<T extends Operation, R>(
  registry: Registry,
  suppliedBinding: OperationBinding<T, R>
) {
  const operation = suppliedBinding.operation
  const inputSchema = operation.input as ZodType<
    import("zod").output<T["input"]>
  >
  if (operation.kind === "read") {
    const execute = suppliedBinding.execute
    if (!execute) throw new Error("Reads require an execute binding")
    const run = execute as (
      input: import("zod").output<T["input"]>,
      actor: Actor,
      registry: Registry
    ) => Promise<R> | R
    const binding = {
      execute: (input: import("zod").output<T["input"]>, actor: Actor) =>
        run(input, actor, registry),
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
    const spec: import("@workspace/domain/kernel").CommandSpec<
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
    registry.addCommand(
      withBasis(
        binding.prepare
          ? {
              ...spec,
              prepare: (
                input: import("zod").output<T["input"]>,
                actor: Actor
              ) => binding.prepare!(input, actor, registry),
            }
          : spec,
        binding.basis
      ),
      async (input, actor, ahead) => {
        const result = await binding.execute(input, actor, registry, ahead)
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
  [N in keyof C]: { operation: C[N]; execute: CatalogImplementation<C[N]> }
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
            activity:
              ((...args: never[]) => ActivityDraft | null) | SilentCommand
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

export function assertReversal(result: {
  reversal: ReversalPlan
  draft: ActivityDraft | null
}) {
  if (
    result.reversal &&
    (!result.reversal.expect ||
      !Object.keys(result.reversal.expect.matches).length)
  )
    throw new Error("Reversals require a guarded expectation")
}
