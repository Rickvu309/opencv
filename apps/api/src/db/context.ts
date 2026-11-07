import { AsyncLocalStorage } from "node:async_hooks"

import { ERROR_CODES } from "@workspace/domain"
import type { NodePgDatabase } from "drizzle-orm/node-postgres"

import { CommandError, isMissingPhoto } from "../registry/errors.js"
import * as schema from "./schema.js"

export type AppDatabase = NodePgDatabase<typeof schema>
type PgliteDrizzle = typeof import("drizzle-orm/pglite").drizzle
export type TestDatabase = ReturnType<PgliteDrizzle>

const requestDb = new AsyncLocalStorage<AppDatabase>()
const transactionDb = new AsyncLocalStorage<AppDatabase>()
let root: AppDatabase | undefined

export function bindDatabase(db: AppDatabase) {
  root = db
}

export function withDatabase<T>(
  db: AppDatabase | TestDatabase,
  fn: () => T
): T {
  return requestDb.run(db as AppDatabase, fn)
}

export function getDb() {
  const current = transactionDb.getStore() ?? requestDb.getStore() ?? root
  if (!current) throw new Error("Database is not bound")
  return current
}

export function insideTransaction() {
  return transactionDb.getStore() !== undefined
}

export async function transaction<T>(fn: () => Promise<T>): Promise<T> {
  if (transactionDb.getStore()) return fn()
  const db = getDb()
  try {
    return await db.transaction((tx) =>
      transactionDb.run(tx as unknown as AppDatabase, fn)
    )
  } catch (error) {
    if (!isMissingPhoto(error)) throw error
    throw new CommandError(ERROR_CODES.NOT_FOUND, "Photo file not found")
  }
}

export async function savepoint<T>(fn: () => Promise<T>): Promise<T> {
  const outer = transactionDb.getStore()
  if (!outer) return fn()
  return outer.transaction((inner) =>
    transactionDb.run(inner as unknown as AppDatabase, fn)
  )
}

export class AmbientTaskTransactionError extends Error {
  readonly code = "AMBIENT_TASK_TRANSACTION"
  constructor() {
    super("Task execution must own its transaction")
    this.name = "AmbientTaskTransactionError"
  }
}

export async function ownedTaskTransaction<T>(
  fn: () => Promise<T>
): Promise<T> {
  if (transactionDb.getStore()) throw new AmbientTaskTransactionError()
  return transaction(fn)
}
