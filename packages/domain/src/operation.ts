import { z } from "zod"
export { z }

import type { CoachAccess, ResourceRef } from "./resources.js"

const legacyDelegateDeclarations = {
  jobRead: { resource: "job", access: "read" },
  reversibleJob: { resource: "job", access: "proposal" },
} as const

type LegacyDelegate = keyof typeof legacyDelegateDeclarations
export type DelegateDeclaration = {
  resource: string
  access: "read" | "proposal"
}
export type DelegateMarker = LegacyDelegate | DelegateDeclaration

export function delegateDeclaration(
  marker: DelegateMarker | undefined
): DelegateDeclaration | null {
  if (!marker) return null
  if (marker === "jobRead" || marker === "reversibleJob")
    return { ...legacyDelegateDeclarations[marker] }
  if (
    typeof marker === "object" &&
    typeof marker.resource === "string" &&
    /^[a-z][a-z0-9]*$/.test(marker.resource) &&
    (marker.access === "read" || marker.access === "proposal") &&
    Object.keys(marker).length === 2
  )
    return { resource: marker.resource, access: marker.access }
  return null
}

export type CoachPolicy =
  | { coach: "auto"; destructive: false }
  | { coach: "confirm" | "never"; destructive: boolean }

type SharedOperation<I extends z.ZodType, O extends z.ZodType> = {
  owner: string
  name: `${string}.${string}`
  version: number
  description: string
  input: I
  publicResult: O
  delegate?: DelegateMarker
}

type OperationShape<
  I extends z.ZodType,
  O extends z.ZodType,
  Parsed = z.output<I>,
> = SharedOperation<I, O> &
  (
    | {
        kind: "read"
        coach: CoachAccess
        dependsOn: (input: Parsed) => readonly ResourceRef[]
      }
    | (CoachPolicy & {
        kind: "command"
        idempotency: "keyed" | "none"
        writes: (input: Parsed) => readonly ResourceRef[]
      })
  )

export type AcceptsOperation<T> =
  T extends OperationShape<
    T extends { input: infer I extends z.ZodType } ? I : never,
    T extends { publicResult: infer O extends z.ZodType } ? O : never
  >
    ? true
    : false

export function defineOperation<
  I extends z.ZodType,
  O extends z.ZodType,
  const T extends OperationShape<I, O>,
>(operation: T & OperationShape<I, O>): T {
  z.string()
    .regex(/^[a-z][a-z0-9]*\.[a-z][a-zA-Z0-9]*$/)
    .parse(operation.name)
  z.string()
    .regex(/^[a-z][a-z0-9-]*$/)
    .parse(operation.owner)
  z.number().int().positive().parse(operation.version)
  z.string().min(1).parse(operation.description)
  z.enum(["auto", "confirm", "never"]).parse(operation.coach)
  z.enum(["read", "command"]).parse(operation.kind)
  const declared = delegateDeclaration(operation.delegate)
  if (operation.delegate !== undefined && !declared)
    throw new Error(
      "Delegate access must name a resource and say read or proposal"
    )
  if (declared && !operation.name.startsWith(`${declared.resource}.`))
    throw new Error(
      `${operation.name} cannot use ${declared.resource} delegate access`
    )
  if (operation.kind === "command") {
    z.enum(["keyed", "none"]).parse(operation.idempotency)
    z.boolean().parse(operation.destructive)
    if (typeof operation.writes !== "function")
      throw new Error("Commands require resource writes")
  } else if (typeof operation.dependsOn !== "function") {
    throw new Error("Reads require resource dependencies")
  }
  return operation
}

export type Operation = OperationShape<z.ZodType, z.ZodType, never>

export type Implementations<C extends Record<string, Operation>> = {
  [N in keyof C]: {
    operation: C[N]
    execute: (
      input: z.output<C[N]["input"]>,
      context: never
    ) => z.input<C[N]["publicResult"]> | Promise<z.input<C[N]["publicResult"]>>
  }
}

export type OperationInput<T extends Operation> = z.input<T["input"]>
export type OperationOutput<T extends Operation> = z.output<T["publicResult"]>
