import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"

import { detect, LOG_PACK, scanned } from "./lib/paper-one-writer.mjs"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

const mistakes = {
  "paper-changes-write": `await getDb().insert(paperChanges).values({ docId, fromVersion: 0 })`,
  "paper-snapshot-write": `await getDb().update(paperDocs).set({ snapshot: doc, headVersion: 4 }).where(eq(paperDocs.id, id))`,
  "paper-changes-sql": `await client.exec(\`delete from "opencv_app"."paper_changes" where doc_id = \${id}\`)`,
  "paper-snapshot-sql": `await db.execute(sql\`update opencv_app.paper_docs set head_version = 0 where id = \${id}\`)`,
}

const clean = `
  await getDb().update(paperDocs).set({ name, isFavorite: true }).where(eq(paperDocs.id, id))
  await getDb().insert(paperDocs).values({ id, userId, name, kind, contentVersion: 0 })
  const rows = await getDb().select().from(paperChanges).where(eq(paperChanges.docId, id))
  await getDb().delete(paperDocs).where(eq(paperDocs.id, id))
  const label = "paper_changes are written by the log"
`

test("only the Paper log writes paper_changes and the snapshot columns", () => {
  for (const [kind, text] of Object.entries(mistakes))
    assert.deepEqual(
      detect(text).map((problem) => problem.kind),
      [kind],
      kind
    )
  assert.deepEqual(detect(clean), [])
  const writer = readFileSync(
    path.join(root, LOG_PACK, "postgres-store.ts"),
    "utf8"
  )
  assert.deepEqual(
    [...new Set(detect(writer).map((problem) => problem.kind))].sort(),
    ["paper-changes-write", "paper-snapshot-write"]
  )
  const files = execFileSync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard"],
    { cwd: root, encoding: "utf8" }
  )
    .split("\n")
    .filter((file) => scanned(file) && existsSync(path.join(root, file)))
  assert.ok(files.length > 500)
  const offenders = files.flatMap((file) =>
    detect(readFileSync(path.join(root, file), "utf8"), file).map(
      (problem) => `${file}:${problem.line} ${problem.kind}`
    )
  )
  assert.deepEqual(offenders, [])
})
