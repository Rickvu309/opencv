import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { classifyMigration, splitStatements } from "./migration-statements.mjs"

const repo = (path) =>
  readFileSync(new URL(`../../../${path}`, import.meta.url), "utf8")

const variants = (sql) => [
  sql,
  sql.toLowerCase(),
  sql.replace(/ /g, "\n  "),
  sql.toLowerCase().replace(/ /g, "\n\t"),
]

const REVIEWER_TABLE = [
  [
    "UPDATE ONLY opencv_app.jobs SET name = 'x'",
    /an UPDATE changes existing rows/,
  ],
  [
    "UPDATE opencv_app.jobs AS j SET name = p.name FROM opencv_app.papers p WHERE p.id = j.id",
    /an UPDATE changes existing rows/,
  ],
  [
    "UPDATE opencv_app.jobs j SET name = p.name FROM opencv_app.papers p",
    /an UPDATE changes existing rows/,
  ],
  ['UPDATE "t" SET a = 1', /an UPDATE changes existing rows/],
  [
    "INSERT INTO opencv_app.jobs (id) VALUES (1) ON CONFLICT (id) DO UPDATE SET id = 2",
    /an upsert/,
  ],
  [
    "INSERT INTO opencv_app.jobs SELECT * FROM opencv_app.old_jobs",
    /an INSERT writes rows/,
  ],
  [
    "REVOKE ALL ON opencv_app.jobs FROM PUBLIC",
    /a REVOKE changes who can reach/,
  ],
  [
    "GRANT SELECT ON opencv_app.jobs TO reader",
    /a GRANT changes who can reach/,
  ],
  [
    "CREATE POLICY own_jobs ON opencv_app.jobs USING (user_id = current_user)",
    /a row-level policy/,
  ],
  [
    "ALTER TABLE opencv_app.jobs ENABLE ROW LEVEL SECURITY",
    /an ALTER TABLE on opencv_app\.jobs/,
  ],
  [
    "CREATE OR REPLACE FUNCTION f() RETURNS trigger AS $$ BEGIN RETURN NEW; END $$ LANGUAGE plpgsql",
    /CREATE OR REPLACE replaces/,
  ],
  [
    "CREATE TRIGGER t BEFORE UPDATE ON opencv_app.jobs FOR EACH ROW EXECUTE FUNCTION f()",
    /a trigger runs code/,
  ],
  ["DO $$ BEGIN DROP INDEX x; END $$", /a DO block runs code/],
  ["DELETE FROM opencv_app.jobs WHERE id = 1", /a DELETE removes/],
  ["TRUNCATE opencv_app.jobs", /a TRUNCATE empties/],
  ["DROP TABLE opencv_app.jobs", /a DROP removes what exists/],
  [
    "ALTER TABLE opencv_app.jobs DROP COLUMN name",
    /an ALTER TABLE on opencv_app\.jobs/,
  ],
  [
    "ALTER TABLE opencv_app.jobs ALTER COLUMN name TYPE text",
    /an ALTER TABLE on opencv_app\.jobs/,
  ],
  [
    "ALTER TABLE opencv_app.jobs RENAME COLUMN a TO b",
    /an ALTER TABLE on opencv_app\.jobs/,
  ],
  [
    "ALTER TABLE opencv_app.jobs ALTER COLUMN name SET NOT NULL",
    /an ALTER TABLE on opencv_app\.jobs/,
  ],
  [
    "ALTER TABLE opencv_app.jobs ADD COLUMN x int NOT NULL",
    /an ALTER TABLE on opencv_app\.jobs/,
  ],
  [
    "ALTER TYPE opencv_app.stage ADD VALUE 'won'",
    /an ALTER changes something that exists/,
  ],
  [
    "CREATE INDEX jobs_name_idx ON opencv_app.jobs (name)",
    /locks its writes while it builds/,
  ],
  [
    "CREATE UNIQUE INDEX jobs_name_idx ON opencv_app.jobs (name)",
    /locks its writes while it builds/,
  ],
  [
    "CREATE INDEX CONCURRENTLY jobs_name_idx ON opencv_app.jobs (name)",
    /builds over its existing rows/,
  ],
  [
    "CREATE TABLE IF NOT EXISTS opencv_app.jobs (a int); ALTER TABLE opencv_app.jobs ADD COLUMN b int",
    /an ALTER TABLE on opencv_app\.jobs/,
  ],
  [
    "CREATE TABLE scratch.jobs (a int); ALTER TABLE opencv_app.jobs ADD COLUMN b int",
    /an ALTER TABLE on opencv_app\.jobs/,
  ],
  [
    "CREATE TABLE opencv_app.part PARTITION OF opencv_app.jobs FOR VALUES IN (1)",
    /without a column list/,
  ],
  [
    "CREATE TABLE opencv_app.kid (a int) INHERITS (opencv_app.jobs)",
    /options after its columns/,
  ],
  ["COMMENT ON TABLE opencv_app.jobs IS 'x'", /did not create/],
  ["VACUUM opencv_app.jobs", /VACUUM opencv_app is not on the only-adds list/],
]

test("every statement the review found, in upper and lower case and split across lines, changes existing things and is named", () => {
  for (const [sql, why] of REVIEWER_TABLE)
    for (const form of variants(sql)) {
      const verdict = classifyMigration(form)
      assert.equal(verdict.onlyAdds, false, form)
      assert.match(verdict.first.why, new RegExp(why.source, "i"), form)
    }
})

test("a '--' inside a string does not hide a later DROP, and a ';' or DROP inside a function body does not split or leak", () => {
  const hidden = classifyMigration(
    `CREATE TABLE "opencv_app"."n" ("a" text DEFAULT '--', "b" text DEFAULT 'it''s'); DROP TABLE "opencv_app"."jobs";`
  )
  assert.deepEqual(
    [hidden.first.n, hidden.first.why],
    [2, "a DROP removes what exists"]
  )
  const body = `CREATE FUNCTION f() RETURNS int AS $body$ SELECT 1; DROP TABLE jobs; $body$ LANGUAGE sql`
  assert.equal(splitStatements(`${body};`).length, 1)
  assert.match(classifyMigration(body).first.why, /a function is code/)
  assert.equal(
    splitStatements(
      `INSERT INTO t VALUES (E'a\\';b', $$x;y$$, "c;d"); /* ; */ SELECT 1`
    ).length,
    2
  )
})

test("only-adds statements on new objects stay quiet, including drizzle's breakpoint marker", () => {
  const sql = [
    'CREATE SCHEMA IF NOT EXISTS "opencv_app";',
    "CREATE TYPE \"opencv_app\".\"mood\" AS ENUM ('calm', 'busy');",
    'CREATE TABLE "opencv_app"."notes" ("id" uuid PRIMARY KEY, "body" text DEFAULT \'--; DROP\');',
    'ALTER TABLE "opencv_app"."notes" ADD COLUMN "mood" "opencv_app"."mood", ADD CONSTRAINT "notes_fk" FOREIGN KEY ("id") REFERENCES "opencv_app"."user"("id") ON DELETE cascade ON UPDATE no action;',
    'CREATE UNIQUE INDEX "notes_body_idx" ON "opencv_app"."notes" USING btree ("body");',
    'CREATE SEQUENCE "opencv_app"."notes_seq" OWNED BY "opencv_app"."notes"."id";',
    'COMMENT ON TABLE "opencv_app"."notes" IS \'new\';',
    'COMMENT ON COLUMN "opencv_app"."notes"."body" IS \'new\';',
    'COMMENT ON INDEX "opencv_app"."notes_body_idx" IS \'new\';',
  ]
  for (const k of variants("a b").keys()) {
    const form = sql
      .map((line) => variants(line)[k])
      .join("\n--> statement-breakpoint\n")
    assert.deepEqual(classifyMigration(form), {
      onlyAdds: true,
      statements: 9,
      first: null,
    })
  }
})

test("an empty file and a file of comments only add nothing and change nothing; an unclosed quote cannot be parsed and changes existing things", () => {
  for (const sql of [
    "",
    "  \n",
    "-- note\n/* block /* nested */ */\n--> statement-breakpoint\n",
  ])
    assert.deepEqual(classifyMigration(sql), {
      onlyAdds: true,
      statements: 0,
      first: null,
    })
  for (const sql of [
    "SELECT 'open",
    'CREATE TABLE "open (a int)',
    "DO $$ BEGIN",
    "/* open",
  ])
    assert.match(
      classifyMigration(sql).first.why,
      /the scanner cannot parse it/,
      sql
    )
})

test("the real migrations on main classify by their content", () => {
  const of = (name) => classifyMigration(repo(`apps/api/drizzle/${name}.sql`))
  const jobs = of("0022_job_word_pages")
  assert.equal(jobs.onlyAdds, false)
  assert.match(
    jobs.first.why,
    /an ALTER TABLE on opencv_app\.jobs, a table this migration did not create/
  )
  for (const name of ["0023_auth_limit_counters", "0024_package_trash"])
    assert.equal(of(name).onlyAdds, true, name)
  const retained = of("0025_word_rename_retained")
  assert.equal(retained.onlyAdds, false)
  assert.equal(retained.first.n, 1)
  assert.match(
    retained.first.text,
    /^CREATE OR REPLACE FUNCTION "opencv_app"\."reject_retained_word_version_update"/
  )
})
