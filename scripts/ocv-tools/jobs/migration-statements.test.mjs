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
    /the table scratch\.jobs is not schema-qualified to opencv_app/,
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
      kinds:
        "1 CREATE SCHEMA, 1 CREATE TYPE, 1 CREATE TABLE, 1 ALTER TABLE of a new table, 1 CREATE INDEX, 1 CREATE SEQUENCE, 3 COMMENT ON",
    })
  }
})

test("an empty file, a file of comments only and a file with only a breakpoint cannot be told apart from a cut-short file and change existing things; an unclosed quote cannot be parsed", () => {
  for (const sql of [
    "",
    "  \n",
    "--> statement-breakpoint\n",
    "-- note\n/* block /* nested */ */\n--> statement-breakpoint\n",
    ";;\n",
  ]) {
    const verdict = classifyMigration(sql)
    assert.equal(verdict.onlyAdds, false, JSON.stringify(sql))
    assert.match(verdict.first.why, /it has no statements/)
  }
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

const ONLY = "only adds"

const ROUND_THREE = [
  [
    'CREATE TABLE opencv_app."JOBS" (id int); ALTER TABLE opencv_app.jobs ADD COLUMN backfilled int NOT NULL',
    /an ALTER TABLE on opencv_app\.jobs, a table this migration did not create/,
  ],
  [
    'CREATE TABLE "opencv_app"."Jobs" (id int); CREATE UNIQUE INDEX jobs_email ON opencv_app.jobs (email)',
    /an index on opencv_app\.jobs/,
  ],
  [
    'CREATE TABLE opencv_app."Papers" (id int); ALTER TABLE opencv_app.papers ADD CONSTRAINT c CHECK (false) NOT VALID',
    /an ALTER TABLE on opencv_app\.papers/,
  ],
  [
    'CREATE TABLE opencv_app."JoBs" (id int); CREATE INDEX i ON opencv_app."JOBS" (id)',
    /an index on opencv_app\."JOBS"/,
  ],
  [
    'CREATE TABLE "opencv_app"."y" (id int); ALTER TABLE opencv_app.y ADD COLUMN a int',
    ONLY,
  ],
  [
    'CREATE TABLE opencv_app."jobs_new" (id int); ALTER TABLE OPENCV_APP.JOBS_NEW ADD COLUMN a int',
    ONLY,
  ],
  [
    'CREATE TABLE opencv_app."Jobs" (id int); ALTER TABLE opencv_app."Jobs" ADD COLUMN a int',
    ONLY,
  ],
  [
    'CREATE TABLE opencv_app."Jobs" (id int); ALTER TABLE opencv_app.Jobs ADD COLUMN a int',
    /an ALTER TABLE on opencv_app\.jobs/,
  ],
  [
    'CREATE TABLE opencv_app."opencv_app.jobs" (id int); ALTER TABLE opencv_app.jobs ADD COLUMN a int',
    /an ALTER TABLE on opencv_app\.jobs/,
  ],
  [
    'CREATE TABLE opencv_app.jobs2 (id int); ALTER TABLE "opencv_app.jobs2" ADD COLUMN a int',
    /an ALTER TABLE on "opencv_app\.jobs2"/,
  ],
  [
    'CREATE TABLE opencv_app."a""b" (id int); ALTER TABLE opencv_app."a""b" ADD COLUMN c int',
    ONLY,
  ],
  [
    'CREATE TABLE opencv_app."jobs""" (id int); ALTER TABLE opencv_app."jobs" ADD COLUMN c int',
    /an ALTER TABLE on opencv_app\.jobs/,
  ],
  ['CREATE TABLE U&"jobs" (id int)', /Unicode-escaped name/],
  [
    'CREATE TABLE opencv_app.x (id int); ALTER TABLE U&"\\0078" ADD COLUMN a int',
    /Unicode-escaped name/,
  ],
  [
    "CREATE TABLE opencv_app.x (id int); COMMENT ON TABLE opencv_app.x IS U&'d\\0061ta'",
    /Unicode-escaped name or string/,
  ],
  ["CREATE TABLE café (id int)", /the character "é" outside quotes/],
  [
    "SET search_path TO opencv_app; CREATE TABLE jobs2 (id int)",
    /SET search_path is not on the only-adds list/,
  ],
  [
    "CREATE TABLE jobs (id int); ALTER TABLE opencv_app.jobs ADD COLUMN a int",
    /the table jobs is not schema-qualified to opencv_app/,
  ],
  [
    "CREATE TABLE opencv_app.jobs3 (id int); ALTER TABLE jobs3 ADD COLUMN a int",
    /an ALTER TABLE on jobs3/,
  ],
  ["CREATE TABLE IF NOT EXISTS opencv_app.jobs (id int)", ONLY],
  [
    "CREATE TABLE IF NOT EXISTS opencv_app.jobs (id int); ALTER TABLE opencv_app.jobs ADD COLUMN a int",
    /an ALTER TABLE on opencv_app\.jobs/,
  ],
  [
    "CREATE TABLE IF NOT EXISTS opencv_app.jobs (id int); CREATE INDEX i ON opencv_app.jobs (id)",
    /an index on opencv_app\.jobs/,
  ],
  [
    "CREATE TABLE IF NOT EXISTS opencv_app.jobs (id int); COMMENT ON TABLE opencv_app.jobs IS 'x'",
    /a COMMENT ON TABLE opencv_app\.jobs/,
  ],
  [
    "CREATE TABLE opencv_app.t (id int); CREATE INDEX IF NOT EXISTS jobs_pkey ON opencv_app.t (id); COMMENT ON INDEX jobs_pkey IS 'x'",
    /a COMMENT ON INDEX jobs_pkey/,
  ],
  [
    "CREATE SEQUENCE IF NOT EXISTS opencv_app.jobs_seq; COMMENT ON SEQUENCE opencv_app.jobs_seq IS 'x'",
    /a COMMENT ON SEQUENCE opencv_app\.jobs_seq/,
  ],
  [
    "CREATE SCHEMA IF NOT EXISTS opencv_app; COMMENT ON SCHEMA opencv_app IS 'x'",
    /a COMMENT ON SCHEMA opencv_app/,
  ],
  ["CREATE OR REPLACE VIEW v AS SELECT 1", /CREATE OR REPLACE replaces/],
  [
    "CREATE OR REPLACE TRIGGER t BEFORE UPDATE ON opencv_app.jobs FOR EACH ROW EXECUTE FUNCTION f()",
    /CREATE OR REPLACE replaces/,
  ],
  [
    "CREATE OR REPLACE RULE r AS ON INSERT TO opencv_app.jobs DO NOTHING",
    /CREATE OR REPLACE replaces/,
  ],
  [
    "ALTER TYPE opencv_app.stage ADD VALUE 'archived'",
    /an ALTER changes something that exists/,
  ],
  [
    "CREATE TYPE opencv_app.mood AS ENUM ('a'); ALTER TYPE opencv_app.mood ADD VALUE 'b'",
    /an ALTER changes something that exists/,
  ],
  [
    "COMMENT ON TABLE opencv_app.jobs IS 'x'",
    /a COMMENT ON TABLE opencv_app\.jobs/,
  ],
  ["COMMENT ON FUNCTION opencv_app.f() IS 'x'", /a COMMENT ON FUNCTION/],
  [
    "COMMENT ON CONSTRAINT c ON opencv_app.jobs IS 'x'",
    /a COMMENT ON CONSTRAINT/,
  ],
  [
    "GRANT USAGE ON SCHEMA opencv_app TO reader",
    /a GRANT changes who can reach/,
  ],
  [
    "CREATE TABLE opencv_app.t (id int); REVOKE ALL ON opencv_app.t FROM PUBLIC",
    /a REVOKE changes who can reach/,
  ],
  [
    "CREATE TABLE opencv_app.a (id int); SELECT 'x; DROP TABLE jobs;",
    /the scanner cannot parse it: a string never closes/,
  ],
  [
    "CREATE TABLE opencv_app.a (id int); DO $q$ BEGIN DROP TABLE jobs; END",
    /the scanner cannot parse it: a \$q\$ body never closes/,
  ],
  [
    'CREATE TABLE opencv_app.a (id int); ALTER TABLE "jobs ADD COLUMN x int',
    /the scanner cannot parse it: a quoted name never closes/,
  ],
  [
    "CREATE TABLE opencv_app.t (id int); CREATE SEQUENCE opencv_app.s OWNED BY opencv_app.jobs.id",
    /a sequence OWNED BY opencv_app\.jobs\.id/,
  ],
  [
    'CREATE TABLE opencv_app.t (id int); CREATE SEQUENCE s OWNED BY "T".id',
    /a sequence OWNED BY "T"\.id/,
  ],
  [
    "CREATE TABLE opencv_app.t (id int); CREATE SEQUENCE opencv_app.s OWNED BY NONE",
    ONLY,
  ],
  ['CREATE TABLE opencv_app."DROP" (id int)', ONLY],
]

test("round three: quoted names keep their case, a dotted quoted name is one name, and anything the scanner does not fully read changes existing things", () => {
  for (const [sql, expected] of ROUND_THREE) {
    const verdict = classifyMigration(sql)
    if (expected === ONLY)
      assert.equal(verdict.onlyAdds, true, `${sql}: ${verdict.first?.why}`)
    else {
      assert.equal(verdict.onlyAdds, false, sql)
      assert.match(verdict.first.why, expected, sql)
    }
  }
})
