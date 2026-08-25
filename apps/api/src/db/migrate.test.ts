import { readFileSync } from "node:fs"
import path from "node:path"
import { PGlite } from "@electric-sql/pglite"
import { sql } from "drizzle-orm"
import { drizzle } from "drizzle-orm/pglite"
import { migrate } from "drizzle-orm/pglite/migrator"
import { describe, expect, it } from "vitest"

import { migrationsFolder } from "./paths.js"

const migratedTables = [
  "account",
  "apply_cards",
  "coach_usage",
  "paper_docs",
  "session",
  "thread_messages",
  "threads",
  "user",
  "verification",
]

async function tableNames(db: ReturnType<typeof drizzle>) {
  const tables = await db.execute<{ table_name: string }>(sql`
    select table_name
    from information_schema.tables
    where table_schema = 'openpath_app'
    order by table_name
  `)

  return tables.rows.map((row) => row.table_name)
}

describe("committed migrations", () => {
  it("apply from scratch on pglite and create openpath_app", async () => {
    const journal = JSON.parse(
      readFileSync(path.join(migrationsFolder, "meta/_journal.json"), "utf8")
    ) as { entries: { tag: string }[] }

    expect(journal.entries.length).toBeGreaterThan(0)

    const client = new PGlite()
    try {
      const db = drizzle({ client })
      await migrate(db, { migrationsFolder })
      await migrate(db, { migrationsFolder })

      const result = await db.execute<{ schema_name: string }>(sql`
        select schema_name
        from information_schema.schemata
        where schema_name = 'openpath_app'
      `)

      expect(result.rows).toEqual([{ schema_name: "openpath_app" }])

      expect(await tableNames(db)).toEqual(migratedTables)

      const messageColumns = await db.execute<{ column_name: string }>(sql`
        select column_name
        from information_schema.columns
        where table_schema = 'openpath_app'
          and table_name = 'thread_messages'
        order by column_name
      `)
      expect(messageColumns.rows.map((row) => row.column_name)).toEqual([
        "created_at",
        "id",
        "parts",
        "role",
        "status",
        "text",
        "thread_id",
        "worked_ms",
      ])

      const usageIndexes = await db.execute<{ indexname: string }>(sql`
        select indexname
        from pg_indexes
        where schemaname = 'openpath_app'
          and tablename = 'coach_usage'
        order by indexname
      `)
      expect(usageIndexes.rows.map((row) => row.indexname)).toEqual([
        "coach_usage_message_id_uidx",
        "coach_usage_pkey",
        "coach_usage_user_id_created_at_idx",
      ])
    } finally {
      await client.close()
    }
  }, 60_000)

  it("apply onto a database that already has openpath_app", async () => {
    const client = new PGlite()
    try {
      const db = drizzle({ client })
      // Production's openpath_app predates these migrations and holds unrelated
      // tables, so 0000 must no-op instead of failing the whole rollout.
      await db.execute(sql`create schema "openpath_app"`)
      await db.execute(
        sql`create table "openpath_app"."legacy_waitlist" ("id" text)`
      )

      await migrate(db, { migrationsFolder })

      expect(await tableNames(db)).toEqual(
        [...migratedTables, "legacy_waitlist"].sort()
      )
    } finally {
      await client.close()
    }
  }, 60_000)
})
