import { readFileSync } from "node:fs"
import path from "node:path"
import { PGlite } from "@electric-sql/pglite"
import { sql } from "drizzle-orm"
import { drizzle } from "drizzle-orm/pglite"
import { migrate } from "drizzle-orm/pglite/migrator"
import { describe, expect, it } from "vitest"

import { migrationsFolder } from "./paths.js"

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

      const tables = await db.execute<{ table_name: string }>(sql`
        select table_name
        from information_schema.tables
        where table_schema = 'openpath_app'
        order by table_name
      `)

      expect(tables.rows.map((row) => row.table_name)).toEqual([
        "account",
        "session",
        "thread_messages",
        "threads",
        "user",
        "verification",
      ])
    } finally {
      await client.close()
    }
  }, 60_000)
})
