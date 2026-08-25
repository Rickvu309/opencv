import { drizzle } from "drizzle-orm/node-postgres"
import { migrate } from "drizzle-orm/node-postgres/migrator"
import { Pool } from "pg"

import { migrationsFolder } from "./paths.js"

export async function applyMigrations(databaseUrl: string) {
  const pool = new Pool({ connectionString: databaseUrl })
  try {
    await migrate(drizzle(pool), { migrationsFolder })
  } finally {
    await pool.end()
  }
}
