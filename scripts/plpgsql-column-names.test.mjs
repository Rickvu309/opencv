import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"
import {
  detect,
  plpgsqlClashes,
  schemaColumnNames,
  sqlTableColumns,
} from "./lib/plpgsql-column-names.mjs"

const root = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..")
const DRIZZLE = path.join(root, "apps/api/drizzle")
const SCHEMA = path.join(root, "apps/api/src/db/schema.ts")
const PAST = "45165951"
const PAST_FILE = "apps/api/drizzle/0008_photo_refs.sql"

const MISTAKE = `CREATE TABLE "opencv_app"."photo_refs" (
  "source" text NOT NULL
);
CREATE OR REPLACE FUNCTION "opencv_app"."sync_idempotency_photo_refs"() RETURNS trigger AS $fn$
DECLARE
  source text;
BEGIN
  RETURN OLD;
END;
$fn$ LANGUAGE plpgsql;
`

const parameter = (name) =>
  `CREATE OR REPLACE FUNCTION "opencv_app"."f"(${name} text) RETURNS void AS $fn$
BEGIN
END;
$fn$ LANGUAGE plpgsql;
`

const readSql = (file) => readFileSync(path.join(DRIZZLE, file), "utf8")

function columnNames() {
  const names = schemaColumnNames(readFileSync(SCHEMA, "utf8"))
  for (const file of readdirSync(DRIZZLE)) {
    if (!file.endsWith(".sql")) continue
    for (const name of sqlTableColumns(readSql(file))) names.add(name)
  }
  return names
}

test("a plpgsql name that matches a column is flagged", () => {
  assert.deepEqual(detect(MISTAKE), ["sync_idempotency_photo_refs source"])
  assert.deepEqual(
    detect(MISTAKE.replace("source text;", "v_source text;")),
    []
  )
  assert.deepEqual(detect(parameter("id")), ["f id"])
  assert.deepEqual(detect(parameter("p_id")), [])
  assert.deepEqual(detect(parameter("p_source")), [])
})

test("the photo refs function that declared source is caught", (t) => {
  let past
  try {
    past = execFileSync("git", ["show", `${PAST}:${PAST_FILE}`], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    })
  } catch {
    return t.skip(`commit ${PAST} is not in this clone`)
  }
  assert.deepEqual(detect(past), ["sync_idempotency_photo_refs source"])
})

test("no drizzle function names a plpgsql variable after a column", () => {
  const names = columnNames()
  const hits = readdirSync(DRIZZLE)
    .filter((file) => file.endsWith(".sql"))
    .sort()
    .flatMap((file) =>
      plpgsqlClashes(readSql(file), names).map((hit) => `${file}: ${hit}`)
    )
  assert.deepEqual(hits, [])
})
