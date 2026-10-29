import { readFileSync, readdirSync } from "node:fs"
import path from "node:path"
import { PGlite } from "@electric-sql/pglite"
import { sql } from "drizzle-orm"
import { drizzle } from "drizzle-orm/pglite"
import { describe, expect, it } from "vitest"

import type { AppDatabase } from "./context.js"
import { runMigrations } from "./migrate.js"
import { migrationsFolder } from "./paths.js"

const productTables = [
  "account",
  "activity",
  "chat_messages",
  "chats",
  "coach_usage",
  "connections",
  "files",
  "idempotency",
  "inbox_messages",
  "inbox_threads",
  "job_checklist",
  "jobs",
  "notify_requests",
  "paper_docs",
  "paper_shares",
  "pending_actions",
  "session",
  "user",
  "verification",
]

const legacySchema = "open" + "path_app"

async function names(db: ReturnType<typeof drizzle>, schemaName: string) {
  const tables = await db.execute<{ table_name: string }>(sql`
    select table_name
    from information_schema.tables
    where table_schema = ${schemaName}
      and table_type = 'BASE TABLE'
    order by table_name
  `)
  return tables.rows.map((row) => row.table_name)
}

describe("opencv_app migrations", () => {
  it("creates every product table on a fresh database", async () => {
    const client = new PGlite()
    const db = drizzle({ client })
    await runMigrations(db as unknown as AppDatabase)
    const tables = await names(db, "opencv_app")
    for (const name of productTables) {
      expect(tables).toContain(name)
    }
    expect(tables).toContain("migrations")
    const journal = JSON.parse(
      readFileSync(path.join(migrationsFolder, "meta/_journal.json"), "utf8")
    ) as { entries: { tag: string }[] }
    expect(journal.entries.map((entry) => entry.tag)).toEqual([
      "0000_opencv_app",
      "0001_account_issuer_optional",
    ])
    const sqlFiles = readdirSync(migrationsFolder).filter((name) =>
      name.endsWith(".sql")
    )
    expect(sqlFiles).toEqual([
      "0000_opencv_app.sql",
      "0001_account_issuer_optional.sql",
    ])
    const source = readFileSync(
      path.join(migrationsFolder, "0000_opencv_app.sql"),
      "utf8"
    )
    expect(source.includes(legacySchema)).toBe(false)
    await client.close()
  })

  it("leaves a legacy schema and its journal untouched", async () => {
    const client = new PGlite()
    const db = drizzle({ client })
    await db.execute(sql.raw(`create schema "${legacySchema}"`))
    await db.execute(
      sql.raw(`create table "${legacySchema}"."legacy_rows" ("id" text)`)
    )
    await db.execute(
      sql.raw(
        `insert into "${legacySchema}"."legacy_rows" ("id") values ('kept')`
      )
    )
    await db.execute(sql.raw(`create schema if not exists "drizzle"`))
    await db.execute(
      sql.raw(
        `create table "drizzle"."__drizzle_migrations" ("id" serial primary key, "hash" text not null, "created_at" bigint)`
      )
    )
    await db.execute(
      sql.raw(
        `insert into "drizzle"."__drizzle_migrations" ("hash", "created_at") values ('legacy-hash', 1)`
      )
    )
    await runMigrations(db as unknown as AppDatabase)
    const legacyTables = await names(db, legacySchema)
    expect(legacyTables).toEqual(["legacy_rows"])
    const kept = await db.execute<{ id: string }>(
      sql.raw(`select "id" from "${legacySchema}"."legacy_rows"`)
    )
    expect(kept.rows).toEqual([{ id: "kept" }])
    const oldJournal = await db.execute<{ hash: string }>(
      sql.raw(`select "hash" from "drizzle"."__drizzle_migrations"`)
    )
    expect(oldJournal.rows).toEqual([{ hash: "legacy-hash" }])
    const tables = await names(db, "opencv_app")
    expect(tables).toContain("jobs")
    expect(tables).toContain("migrations")
    await client.close()
  })
})
