import { PGlite } from "@electric-sql/pglite"
import { drizzle } from "drizzle-orm/pglite"
import { describe, expect, it } from "vitest"

import type { AppDatabase } from "./context.js"
import { runMigrations } from "./migrate.js"
import { staleFunctionRefs } from "./stale-function-refs.js"

const DROPPED_TABLE_GUARD = `
BEGIN
  IF OLD.purpose = 'package' AND EXISTS (
    SELECT 1 FROM "opencv_app"."paper_package_versions" v WHERE v.file_id = OLD.id
  ) THEN RAISE EXCEPTION 'retained package file'; END IF;
  RETURN NEW;
END`

const LIVE_GUARD = `
BEGIN
  DELETE FROM "opencv_app"."paper_photo_refs" WHERE doc_id = OLD.id;
  RETURN OLD;
END`

describe("database functions after every migration", () => {
  it("flags a function that still reads a dropped table", () => {
    expect(
      staleFunctionRefs(
        [{ name: "reject_package_file_update", source: DROPPED_TABLE_GUARD }],
        ["files", "paper_photo_refs"]
      )
    ).toEqual([
      "reject_package_file_update reads opencv_app.paper_package_versions",
    ])
  })

  it("stays quiet for a function whose tables exist", () => {
    expect(
      staleFunctionRefs(
        [{ name: "drop_user_photo_refs", source: LIVE_GUARD }],
        ["paper_photo_refs"]
      )
    ).toEqual([])
  })

  it("leaves no function reading a table or function that is gone", async () => {
    const client = new PGlite()
    try {
      await runMigrations(drizzle({ client }) as unknown as AppDatabase)
      const functions = (
        await client.query<{ name: string; source: string }>(
          `select p.proname as name, p.prosrc as source
             from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'opencv_app'`
        )
      ).rows
      const relations = (
        await client.query<{ name: string }>(
          `select c.relname as name from pg_class c
             join pg_namespace n on n.oid = c.relnamespace
            where n.nspname = 'opencv_app'
           union
           select p.proname from pg_proc p
             join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'opencv_app'
           union
           select t.typname from pg_type t
             join pg_namespace n on n.oid = t.typnamespace
            where n.nspname = 'opencv_app'`
        )
      ).rows.map((row) => row.name)
      expect(staleFunctionRefs(functions, relations)).toEqual([])
    } finally {
      await client.close()
    }
  })
})
