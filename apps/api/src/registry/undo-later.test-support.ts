import type { TestDatabase } from "../db/context.js"
import type { ExecuteResult } from "./registry.js"

export type LaterWorld = {
  userId: string
  db: TestDatabase
  run: (name: string, input: unknown) => Promise<ExecuteResult>
  read: (name: string, input: unknown) => Promise<unknown>
}

export type LaterCase = {
  act: (a: ExecuteResult, world: LaterWorld) => Promise<void>
  survives: (a: ExecuteResult, world: LaterWorld) => Promise<boolean>
}

export type LaterCases = Record<string, LaterCase>

export function outputOf(a: ExecuteResult) {
  return (a.output ?? {}) as Record<string, unknown>
}

export function reversalInputOf(a: ExecuteResult) {
  return (a.reversal?.input ?? {}) as Record<string, unknown>
}
