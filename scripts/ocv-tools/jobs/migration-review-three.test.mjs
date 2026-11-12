import assert from "node:assert/strict"
import test from "node:test"
import { journalChange, migrationFacts } from "./migration-facts.mjs"
import { classifyMigration } from "./migration-statements.mjs"

const T = "T".repeat(70)
const changes = (sql) => classifyMigration(sql)
const held = (sql, pattern, label) => {
  const verdict = changes(sql)
  assert.equal(verdict.onlyAdds, false, `${label}: read as only additive`)
  assert.match(verdict.first.why, pattern, label)
}

test("B4: a dollar tag longer than 62 characters is read as Postgres reads it, so the ALTER it hid is named", () => {
  const sql = [
    "CREATE TABLE opencv_app.t (a int);",
    `COMMENT ON TABLE opencv_app.t IS $${T}$'$${T}$;`,
    "ALTER TABLE opencv_app.jobs ADD COLUMN z int DEFAULT 0 NOT NULL;",
    `COMMENT ON TABLE opencv_app.t IS $${T}$'$${T}$;`,
  ].join("\n")
  const verdict = changes(sql)
  assert.equal(verdict.onlyAdds, false)
  assert.equal(verdict.statements, 4)
  assert.equal(verdict.first.n, 3)
  assert.match(verdict.first.why, /an ALTER TABLE on opencv_app\.jobs/)
  held(
    "CREATE TABLE opencv_app.t (a int); COMMENT ON TABLE opencv_app.t IS 'a' 'b'",
    /not exactly IS followed by one string/,
    "COMMENT with trailing tokens"
  )
  held(
    "CREATE TYPE opencv_app.s AS ENUM ('a'); CREATE TYPE opencv_app.r AS (a int)",
    /CREATE TYPE other than AS ENUM/,
    "composite type"
  )
  assert.equal(
    changes(
      `CREATE TABLE opencv_app.t (a int); COMMENT ON TABLE opencv_app.t IS $${T}$it's$${T}$`
    ).onlyAdds,
    true
  )
})

test("B5: a Unicode space is part of a name to Postgres, so it is unread and the statement is held", () => {
  for (const [label, space, tail] of [
    [
      "S2 U+00A0",
      " ",
      "ALTER TABLE opencv_app.jobs ADD COLUMN z int DEFAULT 0 NOT NULL;",
    ],
    [
      "S3 U+FEFF",
      "﻿",
      "CREATE UNIQUE INDEX jobs_email ON opencv_app.jobs (id);",
    ],
    ["S4 U+2028", " ", "COMMENT ON TABLE opencv_app.jobs IS 'pwned';"],
  ])
    held(
      `CREATE TABLE opencv_app.jobs${space}(id int);\n${tail}`,
      /outside quotes \(U\+/,
      label
    )
  held(
    "﻿CREATE TABLE opencv_app.t (a int)",
    /outside quotes \(U\+FEFF\)/,
    "N20 BOM"
  )
  for (const odd of ["\\", "`", "?", "{", String.fromCharCode(0), "\u007F"])
    held(
      `CREATE TABLE opencv_app.t (a int ${odd})`,
      /outside quotes/,
      JSON.stringify(odd)
    )
  assert.equal(
    changes("CREATE TABLE opencv_app.t (\n\ta int,\r\n\fb int\v);").onlyAdds,
    true
  )
})

test("B7: an unqualified name never matches what this migration made, since Postgres searches pg_catalog first", () => {
  held(
    "CREATE TABLE pg_class (a int); COMMENT ON TABLE pg_class IS 'pwned';",
    /pg_class is not schema-qualified to opencv_app/,
    "S5"
  )
  held(
    "CREATE TYPE int4 AS ENUM ('a'); COMMENT ON TYPE int4 IS 'pwned';",
    /int4 is not schema-qualified to opencv_app/,
    "S6"
  )
  held(
    "CREATE TABLE opencv_app.t (a int); CREATE INDEX pg_class_oid_index ON opencv_app.t (a); COMMENT ON INDEX pg_class_oid_index IS 'x'",
    /a COMMENT ON INDEX pg_class_oid_index, which this migration did not create/,
    "N26"
  )
  held(
    "CREATE TABLE public.t (a int)",
    /public\.t is not schema-qualified/,
    "other schema"
  )
  assert.equal(
    changes(
      "CREATE TABLE opencv_app.t (a int); CREATE INDEX t_a ON opencv_app.t (a); COMMENT ON INDEX opencv_app.t_a IS 'x'"
    ).onlyAdds,
    true
  )
})

const entry = (idx, tag, when) => ({
  idx,
  version: "7",
  when,
  tag,
  breakpoints: true,
})
const journal = (entries) =>
  JSON.stringify({ version: "7", dialect: "postgresql", entries })
const BASE = [
  entry(0, "0000_opencv_app", 1000),
  entry(1, "0001_account_issuer_optional", 2000),
  entry(2, "0002_chat_reply_supersession", 3000),
]
const NEW_SQL = "apps/api/drizzle/0026_new.sql"
const JOURNAL = "apps/api/drizzle/meta/_journal.json"

function gitWith(headJournal, baseFiles = []) {
  return {
    cwd: "/repo",
    ports: {
      proc: {
        run: (cmd, args) => {
          if (args[0] === "merge-base")
            return { ok: true, out: "base1", err: "" }
          if (args[0] === "cat-file")
            return {
              ok: baseFiles.includes(args[2].split(":")[1]),
              out: "",
              err: "",
            }
          const [rev, file] = args[1].split(":")
          if (file === JOURNAL)
            return {
              ok: true,
              out: rev === "base1" ? journal(BASE) : headJournal,
              err: "",
            }
          if (file === NEW_SQL)
            return {
              ok: true,
              out: 'CREATE TABLE "opencv_app"."n" (a int);',
              err: "",
            }
          return { ok: false, out: "", err: "missing" }
        },
      },
    },
  }
}

test("B6: a journal edit that ships with a new migration is read; only an append for the files this pull request adds passes", () => {
  const changed = [JOURNAL, NEW_SQL, "apps/api/drizzle/meta/0026_snapshot.json"]
  const clean = journal([...BASE, entry(3, "0026_new", 4000)])
  assert.equal(journalChange(gitWith(clean), "HEAD", changed), null)
  assert.deepEqual(
    migrationFacts(gitWith(clean), changed, "HEAD").files.map((item) => [
      item.file,
      item.changes,
    ]),
    [[NEW_SQL, []]]
  )
  const mistakes = [
    [
      "an entry naming an older migration",
      journal([
        ...BASE,
        entry(3, "0026_new", 4000),
        entry(4, "0002_chat_reply_supersession", 5000),
      ]),
      /journal entry 4 names 0002_chat_reply_supersession, which is not a migration file this pull request adds/,
    ],
    [
      "an old entry's when bumped",
      journal([
        BASE[0],
        BASE[1],
        { ...BASE[2], when: 9000 },
        entry(3, "0026_new", 9001),
      ]),
      /journal entry 2 \(0002_chat_reply_supersession\) changed or was removed/,
    ],
    [
      "an appended when not after the base",
      journal([...BASE, entry(3, "0026_new", 2500)]),
      /journal entry 3 \(0026_new\) has a when that is not after every earlier entry/,
    ],
    [
      "an idx out of order",
      journal([...BASE, entry(5, "0026_new", 4000)]),
      /journal entry 3 \(0026_new\) has idx 5, not 3/,
    ],
    [
      "an unparseable journal",
      "{ not json",
      /could not be read at the base or the head/,
    ],
  ]
  for (const [label, head, pattern] of mistakes) {
    const item = migrationFacts(gitWith(head), changed, "HEAD").files.find(
      (i) => i.file === JOURNAL
    )
    assert.ok(item, `${label}: the journal is not held`)
    assert.match(item.changes[0], pattern, label)
  }
  assert.match(
    journalChange(gitWith(clean, [NEW_SQL]), "HEAD", changed),
    /not a migration file this pull request adds/
  )
})
