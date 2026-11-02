import { readFileSync, readdirSync } from "node:fs"
import path from "node:path"
import { PGlite } from "@electric-sql/pglite"
import { sql } from "drizzle-orm"
import { readMigrationFiles } from "drizzle-orm/migrator"
import { drizzle } from "drizzle-orm/pglite"
import { describe, expect, it } from "vitest"

import type { AppDatabase } from "./context.js"
import { migrationConfig, runMigrations } from "./migrate.js"
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
  "paper_doc_updates",
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
      "0002_chat_reply_supersession",
      "0003_paper_favorites",
      "0004_paper_crdt_log",
    ])
    const sqlFiles = readdirSync(migrationsFolder).filter((name) =>
      name.endsWith(".sql")
    )
    expect(sqlFiles).toEqual([
      "0000_opencv_app.sql",
      "0001_account_issuer_optional.sql",
      "0002_chat_reply_supersession.sql",
      "0003_paper_favorites.sql",
      "0004_paper_crdt_log.sql",
    ])
    const source = readFileSync(
      path.join(migrationsFolder, "0000_opencv_app.sql"),
      "utf8"
    )
    expect(source.includes(legacySchema)).toBe(false)
    await client.close()
  })

  it("upgrades existing papers to unfavorited without changing their content", async () => {
    const client = new PGlite()
    const db = drizzle({ client })
    try {
      const migrations = readMigrationFiles(migrationConfig())
      const previous = migrations.slice(0, -1)
      for (const migration of previous) {
        for (const statement of migration.sql) await client.exec(statement)
      }
      const last = previous.at(-1)!
      await client.exec(`
        create table "opencv_app"."migrations" (
          id serial primary key, hash text not null, created_at bigint
        );
        insert into "opencv_app"."user" (id, name, email)
          values ('favorite-upgrade', 'Ada', 'favorite-upgrade@example.com');
        insert into "opencv_app"."paper_docs"
          (id, user_id, name, kind, document, content_version, updated_at)
          values ('00000000-0000-4000-8000-000000000659', 'favorite-upgrade',
            'Existing CV', 'cv', '{"version":2}', 7, '2026-01-01T00:00:00Z');
      `)
      await db.execute(sql`
        insert into "opencv_app"."migrations" (hash, created_at)
        values (${last.hash}, ${last.folderMillis})
      `)
      const before = await client.query<Record<string, unknown>>(
        'select document, content_version, updated_at from "opencv_app"."paper_docs"'
      )
      await runMigrations(db as unknown as AppDatabase)
      const after = await client.query(
        'select document, content_version, updated_at, is_favorite from "opencv_app"."paper_docs"'
      )
      expect(after.rows).toEqual([{ ...before.rows[0], is_favorite: false }])
      await runMigrations(db as unknown as AppDatabase)
      expect(
        (
          await client.query(
            'select is_favorite from "opencv_app"."paper_docs"'
          )
        ).rows
      ).toEqual([{ is_favorite: false }])
    } finally {
      await client.close()
    }
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
