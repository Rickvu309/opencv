import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { fixture } from "./fixture.mjs"
import {
  LIVE_HEALTH,
  deployLines,
  migrationChanges,
  migrationFacts,
} from "./migration-facts.mjs"

const sql = (name) =>
  readFileSync(
    new URL(`migration-fixtures/${name}.sql`, import.meta.url),
    "utf8"
  )

test("the mistake fixtures fire: each real migration that changes what exists names its first such statement and why", () => {
  assert.deepEqual(migrationChanges(sql("pr-1326-0022_drop_notify_requests")), [
    'statement 1, DROP TABLE "opencv_app"."notify_requests" CASCADE: a DROP removes what exists',
  ])
  assert.match(
    migrationChanges(sql("pr-1407-0024_word_rename_retained"))[0],
    /^statement 1, CREATE OR REPLACE FUNCTION "opencv_app"\."reject_retained_word_version_update"\(\).*: CREATE OR REPLACE replaces what may exist$/
  )
  assert.match(
    migrationChanges(sql("pr-1381-0022_job_word_pages"))[0],
    /^statement 1, ALTER TABLE "opencv_app"\."jobs" ADD COLUMN "cv_package_id" uuid: an ALTER TABLE on opencv_app\.jobs, a table this migration did not create$/
  )
  assert.deepEqual(
    migrationChanges(
      'ALTER TABLE "a" ADD CONSTRAINT "f" FOREIGN KEY ("u") REFERENCES "b"("id") ON DELETE cascade ON UPDATE no action;'
    ),
    [
      'statement 1, ALTER TABLE "a" ADD CONSTRAINT "f" FOREIGN KEY ("u") REFERENCES "b"("id") ON DELETE cas...: an ALTER TABLE on a, a table this migration did not create',
    ]
  )
})

test("the clean fixtures stay quiet, and the deploy notice counts the statements that only add", () => {
  for (const name of [
    "pr-1406-0023_auth_limit_counters",
    "pr-1407-0023_package_trash",
  ])
    assert.deepEqual(migrationChanges(sql(name)), [], name)
  const files = [
    {
      file: "apps/api/drizzle/0023_a.sql",
      tag: "0023_a",
      statements: 2,
      changes: [],
    },
  ]
  assert.deepEqual(deployLines({ allowed: [], files }).slice(1), [
    "Migration apps/api/drizzle/0023_a.sql only adds: each of its 2 statement(s) is on the only-adds list.",
  ])
  assert.match(
    migrationChanges("--> statement-breakpoint\n")[0],
    /it has no statements/
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
    /REFUSED MIGRATION_CHANGES: the merge runs 0024_word_rename_retained \(statement 1, CREATE OR REPLACE FUNCTION .*: CREATE OR REPLACE replaces what may exist\) on production data/
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
    /Migration apps\/api\/drizzle\/0024_word_rename_retained\.sql changes what exists, first at statement 1, CREATE OR REPLACE FUNCTION .*: CREATE OR REPLACE replaces what may exist; allowed by --allow-migration\./
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

test("a drizzle file the scanner does not read, a journal changed alone, an unread change list and a file that is not UTF-8 each change existing things", () => {
  const shown = new Map([
    [
      "apps/api/drizzle/custom_backfill.sql",
      "UPDATE opencv_app.jobs SET a = 1",
    ],
    ["apps/api/drizzle/0026_bytes.sql", "CREATE TABLE t (id int); �"],
    ["apps/api/drizzle/0027_new.sql", "CREATE TABLE t (id int)"],
  ])
  const ctx = {
    cwd: "/repo",
    ports: {
      proc: {
        run: (cmd, args) => {
          const file = args[1].slice(args[1].indexOf(":") + 1)
          return shown.has(file)
            ? { ok: true, out: shown.get(file), err: "" }
            : { ok: false, out: "", err: "missing" }
        },
      },
    },
  }
  const verdicts = (files) =>
    Object.fromEntries(
      migrationFacts(ctx, files, "HEAD").files.map((item) => [
        item.file,
        item.changes.join("; ") || "only adds",
      ])
    )
  assert.deepEqual(
    verdicts([
      "apps/api/drizzle/custom_backfill.sql",
      "apps/api/drizzle/0026_bytes.sql",
      "apps/api/drizzle/0027_new.sql",
      "apps/api/drizzle/meta/0027_snapshot.json",
      "apps/api/drizzle/meta/_journal.json",
      "apps/api/drizzle/seed.ts",
    ]),
    {
      "apps/api/drizzle/seed.ts":
        "a file under apps/api/drizzle the scanner does not read; it may change what drizzle runs",
      "apps/api/drizzle/0026_bytes.sql":
        "the file is not UTF-8 text (or holds U+FFFD), so the scanner cannot read it as the database will",
      "apps/api/drizzle/0027_new.sql": "only adds",
      "apps/api/drizzle/custom_backfill.sql":
        "statement 1, UPDATE opencv_app.jobs SET a = 1: an UPDATE changes existing rows",
    }
  )
  assert.deepEqual(verdicts(["apps/api/drizzle/meta/_journal.json"]), {
    "apps/api/drizzle/meta/_journal.json":
      "the migration journal changed without a migration file, so it may run a file this pull request did not change",
  })
  assert.deepEqual(verdicts(undefined), {
    "the changed files":
      "the list of changed files could not be read, so no migration can be ruled out",
  })
  assert.deepEqual(verdicts(["apps/api/src/a.ts"]), {})
})
