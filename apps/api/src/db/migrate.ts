import { drizzle as drizzlePg } from "drizzle-orm/node-postgres"
import { Pool } from "pg"

import type { AppDatabase } from "./context.js"
import { migrationsFolder } from "./paths.js"

export { migrationsFolder }

export function migrationConfig() {
  return {
    migrationsFolder,
    migrationsSchema: "opencv_app",
    migrationsTable: "migrations",
  } as const
}

function isPglite(db: object) {
  const client = (db as { $client?: { constructor?: { name?: string } } }).$client
  return client?.constructor?.name === "PGlite"
}

export async function runMigrations(db: AppDatabase) {
  const config = migrationConfig()
  if (isPglite(db)) {
    const { migrate } = await import("drizzle-orm/pglite/migrator")
    await migrate(db as never, config)
    return
  }
  const { migrate } = await import("drizzle-orm/node-postgres/migrator")
  await migrate(db, config)
}

export async function applyMigrations(databaseUrl: string) {
  const pool = new Pool({ connectionString: databaseUrl })
  try {
    await runMigrations(drizzlePg(pool) as AppDatabase)
  } finally {
    await pool.end()
  }
}
