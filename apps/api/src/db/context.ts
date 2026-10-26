import { AsyncLocalStorage } from "node:async_hooks"

import type { NodePgDatabase } from "drizzle-orm/node-postgres"

import * as schema from "./schema.js"

export type AppDatabase = NodePgDatabase<typeof schema>

const requestDb = new AsyncLocalStorage<AppDatabase>()
const transactionDb = new AsyncLocalStorage<AppDatabase>()
let root: AppDatabase | undefined

export function bindDatabase(db: AppDatabase) {
  root = db
}

export function withDatabase<T>(db: AppDatabase, fn: () => T): T {
  return requestDb.run(db, fn)
}

export function getDb() {
  const current = transactionDb.getStore() ?? requestDb.getStore() ?? root
  if (!current) throw new Error("Database is not bound")
  return current
}

export async function transaction<T>(fn: () => Promise<T>): Promise<T> {
  if (transactionDb.getStore()) return fn()
  const db = getDb()
  return db.transaction((tx) =>
    transactionDb.run(tx as unknown as AppDatabase, fn)
  )
}
