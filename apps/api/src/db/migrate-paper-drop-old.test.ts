import { PGlite } from "@electric-sql/pglite"
import { sql } from "drizzle-orm"
import { readMigrationFiles } from "drizzle-orm/migrator"
import { drizzle } from "drizzle-orm/pglite"
import { describe, expect, it } from "vitest"

import type { AppDatabase } from "./context.js"
import { migrationConfig, runMigrations } from "./migrate.js"

const PHOTO = "6f1d3c1e-0a53-4b8e-9d57-2f5c4f0f7a22"
const PACKAGE_FILE = "6f1d3c1e-0a53-4b8e-9d57-2f5c4f0f7a23"
const PAPER = "00000000-0000-4000-8000-000000002326"
const WORD_PAGE = "00000000-0000-4000-8000-000000002327"
const REVISION = "00000000-0000-4000-8000-000000002328"
const INCARNATION = "00000000-0000-4000-8000-000000002329"
const JOB = "00000000-0000-4000-8000-000000002330"

const OLD_TABLES = [
  "paper_doc_updates",
  "paper_package_candidates",
  "paper_package_heads",
  "paper_package_trash",
  "paper_package_versions",
]

const OLD_COLUMNS = [
  "jobs.cv_package_id",
  "jobs.letter_package_id",
  "paper_docs.crdt_base",
  "paper_docs.crdt_base_seq",
  "paper_docs.crdt_document",
  "paper_docs.crdt_epoch",
]

async function rows<T>(client: PGlite, text: string) {
  return (await client.query<T>(text)).rows
}

describe("the paper-drop-old migration", () => {
  it("drops the old Paper tables and columns and keeps every Paper, job link and photo", async () => {
    const client = new PGlite()
    const db = drizzle({ client })
    try {
      const migrations = readMigrationFiles(migrationConfig())
      const dropAt = migrations.findIndex((migration) =>
        migration.sql.some((statement) =>
          statement.includes('DROP TABLE "opencv_app"."paper_doc_updates"')
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
          values ('drop-old', 'Ada', 'drop-old@example.com');
        insert into "opencv_app"."files"
          (id, user_id, name, media_type, byte_size, purpose, bytes)
          values
          ('${PHOTO}', 'drop-old', 'face.png', 'image/png', 1, 'avatar', '\\x89'),
          ('${PACKAGE_FILE}', 'drop-old', 'cv.docx', 'application/zip', 1,
            'package', '\\x50');
        insert into "opencv_app"."paper_docs"
          (id, user_id, name, kind, crdt_document, content_version, engine,
            snapshot)
          values ('${PAPER}', 'drop-old', 'Kept CV', 'cv',
            '{"photo":"file:${PHOTO}"}', 1, 2, '{"type":"doc","content":[]}');
        insert into "opencv_app"."paper_doc_updates"
          (paper_id, seq, origin, update)
          values ('${PAPER}', 1, 'person', '\\x00');
        insert into "opencv_app"."paper_package_versions"
          (revision, doc_id, incarnation, user_id, request_id, name, kind,
            file_id, package_hash, byte_size, sidecar, sidecar_hash,
            projection, projection_hash, projector, cursor_key)
          values ('${REVISION}', '${WORD_PAGE}', '${INCARNATION}', 'drop-old',
            '${REVISION}', 'Word CV', 'cv', '${PACKAGE_FILE}', 'h', 1, '{}',
            'h', '{}', 'h', 'p', 'c');
        insert into "opencv_app"."paper_package_heads"
          (doc_id, user_id, incarnation, revision)
          values ('${WORD_PAGE}', 'drop-old', '${INCARNATION}', '${REVISION}');
        insert into "opencv_app"."jobs"
          (id, user_id, title, company, position, cv_doc_id, letter_package_id)
          values ('${JOB}', 'drop-old', 'Analyst', 'Acme', 'a0', '${PAPER}',
            '${WORD_PAGE}');
      `)
      await db.execute(sql`
        insert into "opencv_app"."migrations" (hash, created_at)
        values (${last.hash}, ${last.folderMillis})
      `)
      expect(
        await rows(
          client,
          `select source from "opencv_app"."photo_refs" where file_id = '${PHOTO}'`
        )
      ).toEqual([{ source: `paper_docs.crdt_document:${PAPER}` }])

      await runMigrations(db as unknown as AppDatabase)

      const tables = await rows<{ table_name: string }>(
        client,
        `select table_name from information_schema.tables
         where table_schema = 'opencv_app'`
      )
      const tableNames = tables.map((row) => row.table_name)
      for (const name of OLD_TABLES) expect(tableNames).not.toContain(name)
      const columns = await rows<{ name: string }>(
        client,
        `select table_name || '.' || column_name as name
         from information_schema.columns
         where table_schema = 'opencv_app'
           and table_name in ('paper_docs', 'jobs')`
      )
      const columnNames = columns.map((row) => row.name)
      for (const name of OLD_COLUMNS) expect(columnNames).not.toContain(name)
      expect(columnNames).toContain("paper_docs.engine")

      expect(
        await rows(client, `select id, name from "opencv_app"."paper_docs"`)
      ).toEqual([{ id: PAPER, name: "Kept CV" }])
      expect(
        await rows(
          client,
          `select cv_doc_id, letter_doc_id from "opencv_app"."jobs"`
        )
      ).toEqual([{ cv_doc_id: PAPER, letter_doc_id: null }])
      expect(
        await rows(client, `select id from "opencv_app"."files" order by id`)
      ).toEqual([{ id: PHOTO }])
      expect(
        await rows(
          client,
          `select source from "opencv_app"."photo_refs" where file_id = '${PHOTO}'`
        )
      ).toEqual([])

      await client.exec(`
        update "opencv_app"."paper_docs"
          set snapshot = '{"type":"doc","photo":"file:${PHOTO}"}'
          where id = '${PAPER}'
      `)
      expect(
        await rows(
          client,
          `select source from "opencv_app"."photo_refs" where file_id = '${PHOTO}'`
        )
      ).toEqual([{ source: `paper_docs.snapshot:${PAPER}` }])
      await client.exec(
        `delete from "opencv_app"."paper_docs" where id = '${PAPER}'`
      )
      await client.exec(
        `delete from "opencv_app"."files" where id = '${PHOTO}'`
      )
      expect(await rows(client, `select id from "opencv_app"."files"`)).toEqual(
        []
      )
    } finally {
      await client.close()
    }
  })
})
