// What these tests are about: the schema is what every later work order builds
// on, so the questions worth asking are "did it apply", "can it apply twice",
// "can it be undone" and "does the database refuse what the application must
// never store". The last one is the reason they run against a real Postgres.

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  applied,
  migrateDown,
  migrateUp,
  migrationStatus,
  readMigrations,
} from "@/lib/db/migrate";
import { skipWithoutDatabase, withTestSchema } from "@/lib/db/testing";

/* ── Reading the files. No database needed, so these always run. ─────────── */

/** A throwaway directory of migration files, and the path to it. */
function fixtureDir(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), "openpath-migrations-"));
  for (const [name, body] of Object.entries(files)) {
    writeFileSync(join(dir, name), body);
  }
  return dir;
}

test("the repository's own migrations are complete pairs", () => {
  const migrations = readMigrations();
  assert.ok(migrations.length >= 3, "expected at least three migrations");
  for (const migration of migrations) {
    assert.ok(migration.up.trim().length > 0, `${migration.id} has an empty up`);
    assert.ok(migration.down.trim().length > 0, `${migration.id} has an empty down`);
  }
  assert.deepEqual(
    migrations.map((m) => m.name),
    ["accounts", "sessions", "app_state"],
    "order matters: sessions and app_state both reference accounts",
  );
});

test("migrations run in numeric order, not alphabetical", () => {
  // The bug this exists for: a string sort puts "10" before "9", so the tenth
  // migration would run before the ninth and reference a table that is not
  // there yet. It only appears once ten migrations exist, which is long after
  // anyone would think to check.
  const dir = fixtureDir({
    "009_ninth.up.sql": "select 9;",
    "009_ninth.down.sql": "select 9;",
    "010_tenth.up.sql": "select 10;",
    "010_tenth.down.sql": "select 10;",
    "1_first.up.sql": "select 1;",
    "1_first.down.sql": "select 1;",
  });
  try {
    assert.deepEqual(
      readMigrations(dir).map((m) => m.id),
      ["1", "009", "010"],
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a migration with no down file is refused, not skipped", () => {
  const dir = fixtureDir({ "001_alone.up.sql": "select 1;" });
  try {
    assert.throws(() => readMigrations(dir), /no \.down\.sql/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a misnamed .sql file is refused rather than ignored", () => {
  // Saved without the direction. Ignoring it means it never runs and never
  // says so, and the schema is quietly wrong everywhere.
  const dir = fixtureDir({ "004_settings.sql": "select 1;" });
  try {
    assert.throws(() => readMigrations(dir), /Unreadable migration file name/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("two migrations cannot share a number", () => {
  const dir = fixtureDir({
    "001_one.up.sql": "select 1;",
    "001_one.down.sql": "select 1;",
    "001_two.up.sql": "select 2;",
    "001_two.down.sql": "select 2;",
  });
  try {
    assert.throws(() => readMigrations(dir), /share the number/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("the checksum follows the up text and ignores line endings", () => {
  const unix = fixtureDir({
    "001_a.up.sql": "create table a ();\n",
    "001_a.down.sql": "drop table a;",
  });
  const windows = fixtureDir({
    "001_a.up.sql": "create table a ();\r\n",
    "001_a.down.sql": "drop table a;",
  });
  const edited = fixtureDir({
    "001_a.up.sql": "create table b ();\n",
    "001_a.down.sql": "drop table a;",
  });
  try {
    assert.equal(
      readMigrations(unix)[0].checksum,
      readMigrations(windows)[0].checksum,
      "a checkout on Windows is not an edit",
    );
    assert.notEqual(
      readMigrations(unix)[0].checksum,
      readMigrations(edited)[0].checksum,
      "a changed statement is an edit",
    );
  } finally {
    for (const dir of [unix, windows, edited]) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

/* ── Against a real Postgres, in a schema that lives for one test. ───────── */

test("every migration applies to an empty schema", { skip: skipWithoutDatabase }, async () => {
  await withTestSchema(async (client, schema) => {
    const ran = await migrateUp(client, { schema });
    assert.deepEqual(ran, ["001", "002", "003"]);

    const { rows } = await client.query<{ table_name: string }>(
      "select table_name from information_schema.tables where table_schema = $1 order by 1",
      [schema],
    );
    assert.deepEqual(
      rows.map((r) => r.table_name),
      ["accounts", "app_state", "schema_migrations", "sessions"],
    );
  });
});

test("applying twice is a no-op, not an error", { skip: skipWithoutDatabase }, async () => {
  await withTestSchema(async (client, schema) => {
    await migrateUp(client, { schema });
    // This is the property that lets the command run in front of every deploy
    // without anyone having to know what the last one did.
    assert.deepEqual(await migrateUp(client, { schema }), []);
    assert.equal((await applied(client)).length, 3);
  });
});

test("rollback undoes the last migration only", { skip: skipWithoutDatabase }, async () => {
  await withTestSchema(async (client, schema) => {
    await migrateUp(client, { schema });

    assert.equal(await migrateDown(client, { schema }), "003");
    const left = (await applied(client)).map((row) => row.id);
    assert.deepEqual(left, ["001", "002"], "only the newest is undone");

    const { rows } = await client.query<{ n: string }>(
      "select count(*) n from information_schema.tables where table_schema = $1 and table_name = 'app_state'",
      [schema],
    );
    assert.equal(rows[0].n, "0", "the table is gone");
  });
});

test("a rolled back migration can be applied again", { skip: skipWithoutDatabase }, async () => {
  await withTestSchema(async (client, schema) => {
    await migrateUp(client, { schema });
    await migrateDown(client, { schema });
    assert.deepEqual(await migrateUp(client, { schema }), ["003"]);
  });
});

test("rolling back an empty schema says so rather than failing", { skip: skipWithoutDatabase }, async () => {
  await withTestSchema(async (client, schema) => {
    assert.equal(await migrateDown(client, { schema }), null);
  });
});

test("editing an applied migration is refused", { skip: skipWithoutDatabase }, async () => {
  await withTestSchema(async (client, schema) => {
    await migrateUp(client, { schema });
    // Same number, different content: the file was changed after it ran. This
    // is the failure that gives two environments different schemas and no
    // symptom until something breaks in one of them.
    const dir = fixtureDir({
      "001_accounts.up.sql": "create table accounts (id uuid primary key);",
      "001_accounts.down.sql": "drop table accounts;",
    });
    try {
      await assert.rejects(
        migrateUp(client, { schema, dir }),
        /was edited after it was applied/,
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

test("status reports pending and applied", { skip: skipWithoutDatabase }, async () => {
  await withTestSchema(async (client, schema) => {
    const before = await migrationStatus(client, { schema });
    assert.equal(before.length, 3);
    assert.ok(before.every((row) => row.appliedAt === null));

    await migrateUp(client, { schema });
    const after = await migrationStatus(client, { schema });
    assert.ok(after.every((row) => row.appliedAt instanceof Date));
    assert.ok(after.every((row) => !row.changed));
  });
});

test("a failed migration leaves no record of itself", { skip: skipWithoutDatabase }, async () => {
  await withTestSchema(async (client, schema) => {
    const dir = fixtureDir({
      "001_broken.up.sql": "create table fine (); create table oops (bad_type_here nosuchtype);",
      "001_broken.down.sql": "drop table fine;",
    });
    try {
      await assert.rejects(migrateUp(client, { schema, dir }), /failed/);
      // Both halves rolled back together: no row claiming it ran, and no
      // half-built schema. Without the transaction, `fine` would exist and the
      // next attempt would fail on a name that is already taken.
      assert.deepEqual(await applied(client), []);
      const { rows } = await client.query<{ n: string }>(
        "select count(*) n from information_schema.tables where table_schema = $1 and table_name = 'fine'",
        [schema],
      );
      assert.equal(rows[0].n, "0");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

/* ── The constraints the schema promises the rest of Phase 1. ───────────── */

test("the database refuses a duplicate username, in any case", { skip: skipWithoutDatabase }, async () => {
  await withTestSchema(async (client, schema) => {
    await migrateUp(client, { schema });
    await client.query("insert into accounts (username, password_hash) values ('Mai', 'x')");

    // Byte-identical.
    await assert.rejects(
      client.query("insert into accounts (username, password_hash) values ('Mai', 'x')"),
      /duplicate key/,
    );
    // And the same name in another case, which a naive unique index allows and
    // which would let a second person be mistaken for the first.
    await assert.rejects(
      client.query("insert into accounts (username, password_hash) values ('mai', 'x')"),
      /duplicate key/,
    );
  });
});

test("deleting an account takes its sessions and state with it", { skip: skipWithoutDatabase }, async () => {
  await withTestSchema(async (client, schema) => {
    await migrateUp(client, { schema });
    const { rows } = await client.query<{ id: string }>(
      "insert into accounts (username, password_hash) values ('mai', 'x') returning id",
    );
    const id = rows[0].id;
    await client.query(
      "insert into sessions (id, account_id, expires_at) values ('abc', $1, now() + interval '7 days')",
      [id],
    );
    await client.query("insert into app_state (account_id, state) values ($1, $2)", [
      id,
      JSON.stringify({ locale: "vi" }),
    ]);

    await client.query("delete from accounts where id = $1", [id]);

    for (const table of ["sessions", "app_state"]) {
      const left = await client.query<{ n: string }>(`select count(*) n from ${table}`);
      assert.equal(left.rows[0].n, "0", `${table} kept an orphan`);
    }
  });
});

test("state cannot be stored for an account that does not exist", { skip: skipWithoutDatabase }, async () => {
  await withTestSchema(async (client, schema) => {
    await migrateUp(client, { schema });
    await assert.rejects(
      client.query(
        "insert into app_state (account_id, state) values ('00000000-0000-0000-0000-000000000000', '{}')",
      ),
      /foreign key/,
    );
  });
});

test("one account has at most one state row", { skip: skipWithoutDatabase }, async () => {
  await withTestSchema(async (client, schema) => {
    await migrateUp(client, { schema });
    const { rows } = await client.query<{ id: string }>(
      "insert into accounts (username, password_hash) values ('mai', 'x') returning id",
    );
    await client.query("insert into app_state (account_id, state) values ($1, '{}')", [rows[0].id]);
    await assert.rejects(
      client.query("insert into app_state (account_id, state) values ($1, '{}')", [rows[0].id]),
      /duplicate key/,
    );
  });
});
