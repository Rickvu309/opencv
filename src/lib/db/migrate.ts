import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import type { ClientBase } from "pg";

import { assertSafeSchema, schemaName } from "./client.server";

/**
 * Schema changes, in order, applied once each.
 *
 * ## Why this is thirty lines of our own rather than a dependency
 *
 * Every migration tool solves the same three problems: run the files in order,
 * run each one once, and let one be undone. What they add on top is a DSL for
 * writing the change in JavaScript, which this codebase does not want. Plain
 * SQL is the language the change is actually in, it is what a reviewer needs to
 * read, and it is what will still be legible when the tool that generated it
 * has been abandoned. So the files are `.sql` and this reads them.
 *
 * The parts that are genuinely easy to get wrong are the parts a tool earns its
 * place on, and they are all here: the bookkeeping row is written inside the
 * same transaction as the change, so a crash cannot leave a migration recorded
 * but not applied; an advisory lock keeps two deploys from racing; and the
 * checksum catches an already-applied file being edited, which is the failure
 * that silently gives two environments different schemas.
 *
 * ## Why numbered files rather than timestamps
 *
 * Timestamps exist so that two branches writing migrations on the same day do
 * not collide. One person is writing these. A number says the order out loud.
 */

export type Migration = {
  /** The numeric prefix, kept as written: "001". */
  id: string;
  /** The rest of the file name: "accounts". */
  name: string;
  up: string;
  down: string;
  /** Of the `up` text. What tells us the file changed after it was applied. */
  checksum: string;
};

export type AppliedMigration = {
  id: string;
  name: string;
  checksum: string;
  appliedAt: Date;
};

export const MIGRATIONS_DIR = join(import.meta.dirname, "migrations");

/** A file name this module recognises: `001_accounts.up.sql`. */
const FILE = /^(\d+)_([a-z0-9_]+)\.(up|down)\.sql$/;

function checksumOf(sql: string): string {
  // Newline-normalised, so a checkout on another platform does not read as an
  // edit. Nothing else is stripped: whitespace inside a statement is the
  // author's, and a "harmless" reformat of an applied migration is still an
  // edit somebody should be told about.
  return createHash("sha256").update(sql.replace(/\r\n/g, "\n")).digest("hex");
}

/**
 * Every migration on disk, in the order they must run.
 *
 * Throws rather than skipping when a pair is incomplete. A missing `down` file
 * is only ever discovered at the moment somebody needs to roll back, which is
 * the worst moment to discover it.
 */
export function readMigrations(dir: string = MIGRATIONS_DIR): Migration[] {
  const halves = new Map<string, { name: string; up?: string; down?: string }>();

  for (const file of readdirSync(dir).sort()) {
    const match = FILE.exec(file);
    if (!match) {
      // A stray file is a mistake worth naming: a migration saved as
      // `004_settings.sql` would otherwise never run and never complain.
      if (file.endsWith(".sql")) {
        throw new Error(`Unreadable migration file name: ${file}`);
      }
      continue;
    }

    const [, id, name, direction] = match;
    const entry = halves.get(id) ?? { name };
    if (entry.name !== name) {
      throw new Error(`Two different migrations share the number ${id}`);
    }
    entry[direction as "up" | "down"] = readFileSync(join(dir, file), "utf8");
    halves.set(id, entry);
  }

  return [...halves.entries()]
    // Numeric, not lexicographic: 10 comes after 9, and a string sort of
    // unpadded numbers is a bug that waits for the tenth migration.
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([id, entry]) => {
      if (!entry.up) throw new Error(`Migration ${id} has no .up.sql`);
      if (!entry.down) throw new Error(`Migration ${id} has no .down.sql`);
      return {
        id,
        name: entry.name,
        up: entry.up,
        down: entry.down,
        checksum: checksumOf(entry.up),
      };
    });
}

/**
 * The schema and the bookkeeping table, made to exist.
 *
 * Called by every entry point below, so no command has an order it must be run
 * in. Creating the schema here is also what lets a test point at a name that
 * does not exist yet and get a clean database out of it.
 */
export async function prepare(
  client: ClientBase,
  schema: string,
): Promise<void> {
  assertSafeSchema(schema);
  await client.query(`create schema if not exists ${schema}`);
  await client.query(`set search_path to ${schema}, public`);
  await client.query(`
    create table if not exists schema_migrations (
      id text primary key,
      name text not null,
      checksum text not null,
      applied_at timestamptz not null default now()
    )
  `);
}

export async function applied(client: ClientBase): Promise<AppliedMigration[]> {
  const { rows } = await client.query<{
    id: string;
    name: string;
    checksum: string;
    applied_at: Date;
  }>("select id, name, checksum, applied_at from schema_migrations order by id");
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    checksum: row.checksum,
    appliedAt: row.applied_at,
  }));
}

/**
 * Hold the migration lock for the duration of `body`.
 *
 * Two instances starting at once is not hypothetical on a platform that scales
 * by starting more of them. Without this, both read an empty
 * `schema_migrations` and both run `create table`, and the loser crashes on a
 * name that now exists. The lock is released with the session, so a killed
 * process does not leave it held.
 */
async function withLock<T>(
  client: ClientBase,
  body: () => Promise<T>,
): Promise<T> {
  // An arbitrary constant, unique to this application's migrations.
  await client.query("select pg_advisory_lock(4207431)");
  try {
    return await body();
  } finally {
    await client.query("select pg_advisory_unlock(4207431)");
  }
}

/**
 * Apply everything not yet applied. Returns the ids that ran.
 *
 * Running it twice is not an error, the second run does nothing, which is what
 * makes it safe to put in front of a deploy.
 */
export async function migrateUp(
  client: ClientBase,
  options: { schema?: string; dir?: string } = {},
): Promise<string[]> {
  const schema = options.schema ?? schemaName();
  await prepare(client, schema);

  return withLock(client, async () => {
    const migrations = readMigrations(options.dir);
    const done = new Map((await applied(client)).map((row) => [row.id, row]));
    const ran: string[] = [];

    for (const migration of migrations) {
      const previous = done.get(migration.id);
      if (previous) {
        // The file changed after it was applied. Whatever the author intended,
        // this database no longer matches the repository, and every other
        // database is now a coin flip. Refusing is the only useful answer.
        if (previous.checksum !== migration.checksum) {
          throw new Error(
            `Migration ${migration.id}_${migration.name} was edited after it was applied. ` +
              `Write a new migration instead of changing this one.`,
          );
        }
        continue;
      }

      // The change and the record of it commit together or not at all.
      await client.query("begin");
      try {
        await client.query(migration.up);
        await client.query(
          "insert into schema_migrations (id, name, checksum) values ($1, $2, $3)",
          [migration.id, migration.name, migration.checksum],
        );
        await client.query("commit");
      } catch (error) {
        await client.query("rollback");
        throw new Error(
          `Migration ${migration.id}_${migration.name} failed: ${(error as Error).message}`,
          { cause: error },
        );
      }
      ran.push(migration.id);
    }

    return ran;
  });
}

/**
 * Undo the most recently applied migration. Returns its id, or null when there
 * is nothing left to undo.
 *
 * One at a time on purpose. A rollback is something a person does while
 * watching, and "undo everything" is a command whose usual outcome is an empty
 * database that nobody meant to create.
 */
export async function migrateDown(
  client: ClientBase,
  options: { schema?: string; dir?: string } = {},
): Promise<string | null> {
  const schema = options.schema ?? schemaName();
  await prepare(client, schema);

  return withLock(client, async () => {
    const done = await applied(client);
    const last = done.at(-1);
    if (!last) return null;

    const migration = readMigrations(options.dir).find((m) => m.id === last.id);
    if (!migration) {
      throw new Error(
        `Migration ${last.id}_${last.name} is applied here but its files are gone, ` +
          `so it cannot be undone. Restore the files or delete the row by hand.`,
      );
    }

    await client.query("begin");
    try {
      await client.query(migration.down);
      await client.query("delete from schema_migrations where id = $1", [last.id]);
      await client.query("commit");
    } catch (error) {
      await client.query("rollback");
      throw new Error(
        `Rollback of ${migration.id}_${migration.name} failed: ${(error as Error).message}`,
        { cause: error },
      );
    }

    return last.id;
  });
}

export type MigrationStatus = {
  id: string;
  name: string;
  appliedAt: Date | null;
  /** True when the file on disk differs from what was applied. */
  changed: boolean;
};

/** What is applied, what is pending, and what has been edited underneath us. */
export async function migrationStatus(
  client: ClientBase,
  options: { schema?: string; dir?: string } = {},
): Promise<MigrationStatus[]> {
  await prepare(client, options.schema ?? schemaName());
  const done = new Map((await applied(client)).map((row) => [row.id, row]));

  return readMigrations(options.dir).map((migration) => {
    const previous = done.get(migration.id);
    return {
      id: migration.id,
      name: migration.name,
      appliedAt: previous?.appliedAt ?? null,
      changed: previous ? previous.checksum !== migration.checksum : false,
    };
  });
}
