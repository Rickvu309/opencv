import { AsyncLocalStorage } from "node:async_hooks"

import { ERROR_CODES } from "@workspace/domain/kernel"
import type { NodePgDatabase } from "drizzle-orm/node-postgres"

import { CommandError, isMissingPhoto } from "../platform/errors.js"
import * as schema from "./schema.js"

export type AppDatabase = NodePgDatabase<typeof schema>
type PgliteDrizzle = typeof import("drizzle-orm/pglite").drizzle
export type TestDatabase = ReturnType<PgliteDrizzle>

const requestDb = new AsyncLocalStorage<AppDatabase>()
type TransactionLifetime = {
  db: AppDatabase
  closed: boolean
  parent: TransactionLifetime | undefined
}

const transactionDb = new AsyncLocalStorage<TransactionLifetime>()
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
  const lifetime = transactionDb.getStore()
  if (lifetime && !transactionOpen(lifetime))
    throw new CommandError(ERROR_CODES.FORBIDDEN, "This save has ended")
  const current = lifetime?.db ?? requestDb.getStore() ?? root
  if (!current) throw new Error("Database is not bound")
  return current
}

export function insideTransaction() {
  const lifetime = transactionDb.getStore()
  return lifetime !== undefined && transactionOpen(lifetime)
}

export function outsideTransaction<T>(fn: () => T): T {
  return transactionDb.exit(fn)
}

function transactionOpen(lifetime: TransactionLifetime): boolean {
  return (
    !lifetime.closed && (!lifetime.parent || transactionOpen(lifetime.parent))
  )
}

async function runTransaction<T>(
  db: AppDatabase,
  fn: () => Promise<T>
): Promise<T> {
  const lifetime: TransactionLifetime = {
    db,
    closed: false,
    parent: transactionDb.getStore(),
  }
  return transactionDb.run(lifetime, async () => {
    try {
      return await fn()
    } finally {
      lifetime.closed = true
    }
  })
}

export async function transaction<T>(fn: () => Promise<T>): Promise<T> {
  if (transactionDb.getStore()) {
    getDb()
    return fn()
  }
  const db = getDb()
  try {
    return await db.transaction((tx) =>
      runTransaction(tx as unknown as AppDatabase, fn)
    )
  } catch (error) {
    if (!isMissingPhoto(error)) throw error
    throw new CommandError(ERROR_CODES.NOT_FOUND, "Photo file not found")
  }
}

export async function savepoint<T>(fn: () => Promise<T>): Promise<T> {
  const outer = transactionDb.getStore()
  if (!outer) return fn()
  return getDb().transaction((inner) =>
    runTransaction(inner as unknown as AppDatabase, fn)
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
