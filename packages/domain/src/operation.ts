import { z } from "zod"

import type { IdempotencyPolicy } from "./contract.js"
import type { CoachAccess } from "./registry.js"
import type { ResourceRef } from "./resources.js"

type BaseOperation<I extends z.ZodType, O extends z.ZodType> = {
  name: `${string}.${string}`
  version: number
  description: string
  input: I
  publicResult: O
  coach: CoachAccess
}

type OperationShape<
  I extends z.ZodType,
  O extends z.ZodType,
  Parsed = z.output<I>,
> = BaseOperation<I, O> &
  (
    | {
        kind: "read"
        dependsOn: (input: Parsed) => readonly ResourceRef[]
      }
    | {
        kind: "command"
        destructive: boolean
        idempotency: IdempotencyPolicy
        writes: (input: Parsed) => readonly ResourceRef[]
      }
  )

export function defineOperation<
  I extends z.ZodType,
  O extends z.ZodType,
  const T extends OperationShape<I, O>,
>(operation: T & OperationShape<I, O>): T {
  z.string()
    .regex(/^[a-z][a-z0-9]*\.[a-z][a-zA-Z0-9]*$/)
    .parse(operation.name)
  z.number().int().positive().parse(operation.version)
  z.string().min(1).parse(operation.description)
  z.enum(["auto", "confirm", "never"]).parse(operation.coach)
  z.enum(["read", "command"]).parse(operation.kind)
  if (operation.kind === "command") {
    z.enum(["keyed", "none"]).parse(operation.idempotency)
    z.boolean().parse(operation.destructive)
    if (operation.coach === "auto" && operation.destructive)
      throw new Error(
        "Destructive commands require confirmation or person access"
      )
    if (typeof operation.writes !== "function")
      throw new Error("Commands require resource writes")
  } else if (typeof operation.dependsOn !== "function") {
    throw new Error("Reads require resource dependencies")
  }
  return operation
}

type Operation = OperationShape<z.ZodType, z.ZodType, never>

export type Implementations<C extends Record<string, Operation>> = {
  [N in keyof C]: {
    operation: C[N]
    execute: (
      input: z.output<C[N]["input"]>,
      context: never
    ) => z.input<C[N]["publicResult"]> | Promise<z.input<C[N]["publicResult"]>>
  }
}
