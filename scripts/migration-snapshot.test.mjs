import assert from "node:assert/strict"
import { cpSync, readFileSync, symlinkSync, writeFileSync } from "node:fs"
import { homedir } from "node:os"
import path from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"
import {
  detect,
  generateSql,
  missingSnapshot,
} from "./lib/migration-snapshot.mjs"
import { tempDir } from "./lib/temp-dir.mjs"

const root = fileURLToPath(new URL("../", import.meta.url))

test("a migration without its latest snapshot fires and a captured schema stays quiet", () => {
  const journal = { entries: [{ idx: 1, tag: "0001_change" }] }
  assert.deepEqual(missingSnapshot(journal, null), [
    "0001_snapshot.json is missing after 0001_change",
  ])
  assert.deepEqual(missingSnapshot(journal, "{}"), [])
})

test("the latest migration has a snapshot", () => {
  assert.deepEqual(
    detect(
      readFileSync(
        path.join(root, "apps/api/drizzle/meta/_journal.json"),
        "utf8"
      )
    ),
    []
  )
})

test("the checked-in schema generates no SQL without changing tracked migrations", () => {
  assert.deepEqual(generateSql(), [])
})

test("a schema change without a migration emits SQL and the unchanged schema stays quiet", (t) => {
  const dir = tempDir(t, "migration-fixture-", path.join(homedir(), "tmp"))
  const schema = path.join(dir, "schema.ts")
  cpSync(path.join(root, "apps/api/src/db"), dir, { recursive: true })
  symlinkSync(
    path.join(root, "apps/api/node_modules"),
    path.join(dir, "node_modules")
  )
  const source = readFileSync(
    path.join(root, "apps/api/src/db/schema.ts"),
    "utf8"
  )
  writeFileSync(
    schema,
    source.replace(
      'isFavorite: boolean("is_favorite")',
      'unmigratedWeekly: boolean("unmigrated_weekly"), isFavorite: boolean("is_favorite")'
    )
  )
  const sql = generateSql({ schema })
  assert.equal(sql.length, 1)
  assert.match(sql[0], /ADD COLUMN "unmigrated_weekly" boolean/)
  writeFileSync(schema, source)
  assert.deepEqual(generateSql({ schema }), [])
})
