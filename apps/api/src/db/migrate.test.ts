import { readFileSync, readdirSync } from "node:fs"
import path from "node:path"
import { PGlite } from "@electric-sql/pglite"
import { sql } from "drizzle-orm"
import { readMigrationFiles } from "drizzle-orm/migrator"
import { drizzle } from "drizzle-orm/pglite"
import { describe, expect, it } from "vitest"

import type { AppDatabase } from "./context.js"
import { migrationConfig, runMigrations } from "./migrate.js"
import {
  journalEntries,
  journalTags,
  newestTagByWhen,
} from "../test/migration-journal.js"
import { migrationsFolder } from "./paths.js"

const productTables = [
  "account",
  "agent_connections",
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
  "oauth_access_token",
  "oauth_client",
  "oauth_client_assertion",
  "oauth_client_resource",
  "oauth_consent",
  "oauth_refresh_token",
  "oauth_resource",
  "paper_changes",
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
    const tags = journalTags()
    expect(tags.length).toBeGreaterThan(0)
    expect(tags.map((tag) => tag.slice(0, 4))).toEqual(
      tags.map((_, index) => String(index).padStart(4, "0"))
    )
    const entries = journalEntries()
    expect(entries.map((entry) => entry.idx)).toEqual(
      entries.map((_, index) => index)
    )
    for (const [index, entry] of entries.entries()) {
      if (index > 0)
        expect(entry.when).toBeGreaterThan(entries[index - 1]!.when)
    }
    const sqlFiles = readdirSync(migrationsFolder).filter((name) =>
      name.endsWith(".sql")
    )
    expect(sqlFiles).toEqual(tags.map((tag) => `${tag}.sql`))
    const source = readFileSync(
      path.join(migrationsFolder, `${tags[0]}.sql`),
      "utf8"
    )
    expect(source.includes(legacySchema)).toBe(false)
    await client.close()
  })

  it("names the newest migration by when, not by journal position", () => {
    expect(
      newestTagByWhen([
        { idx: 0, when: 300, tag: "a_renumbered_late" },
        { idx: 1, when: 100, tag: "b_first" },
        { idx: 2, when: 200, tag: "c_second" },
      ])
    ).toBe("a_renumbered_late")
  })

  it("upgrades existing papers to unfavorited without changing their content", async () => {
    const client = new PGlite()
    const db = drizzle({ client })
    try {
      const migrations = readMigrationFiles(migrationConfig())
      const favoritesAt = migrations.findIndex((migration) =>
        migration.sql.some((statement) => statement.includes('"is_favorite"'))
      )
      const reset = migrations.find((migration) =>
        migration.sql.some((statement) =>
          statement.includes('DELETE FROM "opencv_app"."paper_docs"')
        )
      )
      const newest = migrations.at(-1)
      expect(favoritesAt).toBeGreaterThan(0)
      expect(reset).toBeDefined()
      for (const migration of migrations.slice(0, favoritesAt)) {
        for (const statement of migration.sql) await client.exec(statement)
      }
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
      const before = await client.query<Record<string, unknown>>(
        'select document, content_version, updated_at from "opencv_app"."paper_docs"'
      )
      for (const statement of migrations[favoritesAt]!.sql) {
        await client.exec(statement)
      }
      const after = await client.query(
        'select document, content_version, updated_at, is_favorite from "opencv_app"."paper_docs"'
      )
      expect(after.rows).toEqual([{ ...before.rows[0], is_favorite: false }])
      await db.execute(sql`
        insert into "opencv_app"."migrations" (hash, created_at)
        values (${newest!.hash}, ${newest!.folderMillis})
      `)
      await runMigrations(db as unknown as AppDatabase)
      await runMigrations(db as unknown as AppDatabase)
      expect(
        (
          await client.query(
            'select document, content_version, updated_at, is_favorite from "opencv_app"."paper_docs"'
          )
        ).rows
      ).toEqual(after.rows)
    } finally {
      await client.close()
    }
  })

  it("drops the stored document and leaves the snapshot and favorite flag", async () => {
    const client = new PGlite()
    const db = drizzle({ client })
    try {
      const migrations = readMigrationFiles(migrationConfig())
      const dropAt = migrations.findIndex((migration) =>
        migration.sql.some((statement) =>
          statement.includes('DROP COLUMN "document"')
        )
      )
      expect(dropAt).toBeGreaterThan(0)
      const previous = migrations.slice(0, dropAt)
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
        insert into "opencv_app"."files"
          (id, user_id, name, media_type, byte_size, purpose, bytes)
          values ('6f1d3c1e-0a53-4b8e-9d57-2f5c4f0f7a11', 'favorite-upgrade',
            'face.png', 'image/png', 1, 'avatar', '\\x89');
        insert into "opencv_app"."paper_docs"
          (id, user_id, name, kind, document, crdt_document, content_version, updated_at)
          values ('00000000-0000-4000-8000-000000000659', 'favorite-upgrade',
            'Existing CV', 'cv',
            '{"version":2,"header":{"name":"Lan","photo":"file:6f1d3c1e-0a53-4b8e-9d57-2f5c4f0f7a11"}}',
            '{"version":4,"schemaRevision":2,"kind":"cv"}',
            7, '2026-01-01T00:00:00Z');
      `)
      expect(
        (
          await client.query<{ source: string }>(
            `select source from "opencv_app"."photo_refs"
             where file_id = '6f1d3c1e-0a53-4b8e-9d57-2f5c4f0f7a11'
             order by source`
          )
        ).rows
      ).toEqual([
        {
          source: "paper_docs.document:00000000-0000-4000-8000-000000000659",
        },
      ])
      await db.execute(sql`
        insert into "opencv_app"."migrations" (hash, created_at)
        values (${last.hash}, ${last.folderMillis})
      `)
      const before = await client.query<Record<string, unknown>>(
        'select crdt_document, content_version, updated_at, is_favorite from "opencv_app"."paper_docs"'
      )
      await runMigrations(db as unknown as AppDatabase)
      const after = await client.query(
        'select crdt_document, content_version, updated_at, is_favorite from "opencv_app"."paper_docs"'
      )
      expect(after.rows).toEqual(before.rows)
      expect(
        (
          await client.query(
            `select column_name from information_schema.columns
             where table_schema = 'opencv_app'
               and table_name = 'paper_docs'
               and column_name = 'document'`
          )
        ).rows
      ).toEqual([])
      expect(
        (
          await client.query(
            `select source from "opencv_app"."photo_refs"
             where file_id = '6f1d3c1e-0a53-4b8e-9d57-2f5c4f0f7a11'`
          )
        ).rows
      ).toEqual([])
      await client.exec(
        `delete from "opencv_app"."files" where id = '6f1d3c1e-0a53-4b8e-9d57-2f5c4f0f7a11'`
      )
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

  it("adds the Paper change log beside existing papers without changing them", async () => {
    const client = new PGlite()
    const db = drizzle({ client })
    try {
      const migrations = readMigrationFiles(migrationConfig())
      const logAt = migrations.findIndex((migration) =>
        migration.sql.some((statement) =>
          statement.includes('CREATE TABLE "opencv_app"."paper_changes"')
        )
      )
      expect(logAt).toBeGreaterThan(0)
      const previous = migrations.slice(0, logAt)
      for (const migration of previous) {
        for (const statement of migration.sql) await client.exec(statement)
      }
      const last = previous.at(-1)!
      await client.exec(`
        create table "opencv_app"."migrations" (
          id serial primary key, hash text not null, created_at bigint
        );
        insert into "opencv_app"."user" (id, name, email)
          values ('log-upgrade', 'Ada', 'log-upgrade@example.com');
        insert into "opencv_app"."paper_docs"
          (id, user_id, name, kind, crdt_document, content_version, updated_at)
          values ('00000000-0000-4000-8000-000000002228', 'log-upgrade',
            'Existing CV', 'cv', '{"version":4,"schemaRevision":2,"kind":"cv"}',
            7, '2026-01-01T00:00:00Z');
      `)
      await db.execute(sql`
        insert into "opencv_app"."migrations" (hash, created_at)
        values (${last.hash}, ${last.folderMillis})
      `)
      const columns =
        "name, kind, crdt_document, content_version, updated_at, is_favorite"
      const before = await client.query(
        `select ${columns} from "opencv_app"."paper_docs"`
      )
      await runMigrations(db as unknown as AppDatabase)
      const after = await client.query(
        `select ${columns}, engine, head_version, snapshot, snapshot_version, first_page
         from "opencv_app"."paper_docs"`
      )
      expect(after.rows).toEqual([
        {
          ...before.rows[0]!,
          engine: 1,
          head_version: 0,
          snapshot: null,
          snapshot_version: 0,
          first_page: null,
        },
      ])
      expect(
        (await client.query('select * from "opencv_app"."paper_changes"')).rows
      ).toEqual([])
      await expect(
        client.exec(`
          insert into "opencv_app"."paper_changes"
            (doc_id, from_version, to_version, edit_id, client_id, origin_kind,
             origin_actor, steps, inverse, commands)
          values ('00000000-0000-4000-8000-000000002228', 3, 3, 'e', 'c',
            'person', 'a', '[]', '[]', '[]')
        `)
      ).rejects.toThrow(/paper_changes_versions_ascend/)
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
