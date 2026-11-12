import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { fixture } from "./fixture.mjs"
import { LIVE_HEALTH, migrationChanges } from "./migration-facts.mjs"

const sql = (name) =>
  readFileSync(
    new URL(`migration-fixtures/${name}.sql`, import.meta.url),
    "utf8"
  )

test("the mistake fixtures fire: the real migrations that change what exists are named with what they change", () => {
  assert.deepEqual(migrationChanges(sql("pr-1326-0022_drop_notify_requests")), [
    "DROP",
  ])
  assert.deepEqual(migrationChanges(sql("pr-1407-0024_word_rename_retained")), [
    "CREATE OR REPLACE",
    "a trigger",
  ])
  assert.deepEqual(migrationChanges(sql("pr-1381-0022_job_word_pages")), [
    "ALTER TABLE jobs",
  ])
})

test("the clean fixtures stay quiet: a new table, its own constraints and indexes only add", () => {
  for (const name of [
    "pr-1406-0023_auth_limit_counters",
    "pr-1407-0023_package_trash",
  ])
    assert.deepEqual(migrationChanges(sql(name)), [], name)
  assert.deepEqual(
    migrationChanges(
      'ALTER TABLE "a" ADD CONSTRAINT "f" FOREIGN KEY ("u") REFERENCES "b"("id") ON DELETE cascade ON UPDATE no action;'
    ),
    ["ALTER TABLE a"]
  )
})

const MIGRATION = "apps/api/drizzle/0024_word_rename_retained.sql"

function mergeWorld(extra = {}) {
  return fixture({
    changed: ["apps/api/src/paper/store.ts", MIGRATION],
    intercept(cmd, args) {
      if (cmd === "git" && args[0] === "show" && args[1].endsWith(MIGRATION))
        return {
          ok: true,
          out: sql("pr-1407-0024_word_rename_retained"),
          err: "",
        }
    },
    ...extra,
  })
}

test("merge refuses to queue a migration that changes what exists, and says the merge deploys", () => {
  const f = mergeWorld()
  const r = f.call("merge", "91")
  assert.equal(r.code, 2, r.text)
  assert.match(
    r.text,
    /REFUSED MIGRATION_CHANGES: the merge runs 0024_word_rename_retained \(CREATE OR REPLACE, a trigger\) on production data/
  )
  assert.match(r.text, /--allow-migration 0024_word_rename_retained/)
  assert.equal(f.effects("gh", "pr merge").length, 0)
})

test("merge with --allow-migration names the deploy and the migration, queues, and prints the live check without calling it", () => {
  const f = mergeWorld()
  const r = f.call(
    "merge",
    "91",
    "--allow-migration",
    "0024_word_rename_retained"
  )
  assert.equal(r.code, 0, r.text)
  assert.match(r.text, /This merge deploys to production/)
  assert.match(
    r.text,
    /Migration apps\/api\/drizzle\/0024_word_rename_retained\.sql changes what exists \(CREATE OR REPLACE, a trigger\), allowed by --allow-migration\./
  )
  assert.match(
    r.text,
    new RegExp(`See it live: ${LIVE_HEALTH.replace(/[.]/g, "\\.")}`)
  )
  assert.match(r.text, /expect \S+ and 0024_word_rename_retained/)
  assert.equal(f.effects("gh", "pr merge").length, 1)
  for (const job of ["merge.mjs", "migration-facts.mjs"])
    assert.doesNotMatch(
      readFileSync(new URL(job, import.meta.url), "utf8"),
      /ports\.proc\.run\("curl"|run\(ctx, "curl"/
    )
})

test("merge of a PR with no migration says it deploys and carries none", () => {
  const f = fixture()
  const r = f.call("merge", "91")
  assert.equal(r.code, 0, r.text)
  assert.match(r.text, /This merge deploys to production/)
  assert.match(r.text, /It carries no database migration\./)
})
