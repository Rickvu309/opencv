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

import type { Registry } from "./registry.js"

type Binding<C extends CommandContract, N extends keyof C & string> = {
  handler: (
    input: CommandInput<C, N>,
    actor: Actor
  ) => Promise<CommandOutput<C, N>>
  reversal: (
    input: CommandInput<C, N>,
    output: CommandOutput<C, N>
  ) => ReversalCall<C> | null
  activity: (
    input: CommandInput<C, N>,
    output: CommandOutput<C, N>,
    actor: Actor
  ) => ActivityDraft | null
}

export type Bindings<C extends CommandContract> = {
  [N in keyof C & string]: Binding<C, N>
}

type LooseBinding = {
  handler: (input: unknown, actor: Actor) => Promise<unknown>
  reversal: CommandSpec<unknown, unknown>["reversal"]
  activity: CommandSpec<unknown, unknown>["activity"]
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
        destructive: entry.destructive,
        step: entry.step,
        reversal: bound.reversal,
        activity: bound.activity,
      },
      bound.handler
    )
  }
}

type TableQuerySpec<N extends QueryName> = {
  description: string
  coach: boolean
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
