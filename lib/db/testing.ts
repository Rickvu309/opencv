import { randomBytes } from "node:crypto";

import pg from "pg";

import { connectionConfig } from "./client";

/**
 * A real database for a test, and no way for it to touch anything real.
 *
 * ## Why this points at production
 *
 * There is one Postgres. Standing up a second for tests is a second thing to
 * pay for, provision and remember, and a fake one in memory would test the fake
 * rather than the constraints, which is the entire reason these tests exist: a
 * unique index either refuses the second `insert` or it does not, and only
 * Postgres knows.
 *
 * What makes that safe is not care, it is scope. Every run creates a schema
 * with a random name, does all of its work inside it, and drops it. A test
 * cannot see the application's tables because they are not on its
 * `search_path`, and it cannot leave anything behind because the drop is in a
 * `finally`. The blast radius is a schema that existed for two seconds.
 *
 * ## Why the tests skip rather than fail without a URL
 *
 * `npm test` has to work on a laptop with no network. A suite that fails there
 * teaches people to ignore red, which costs more than these tests are worth.
 * They announce the skip instead.
 */

export const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;

/** Why the database tests are not running, or null when they are. */
export const skipWithoutDatabase = TEST_DATABASE_URL
  ? false
  : "TEST_DATABASE_URL is not set";

/**
 * Run `body` against a connection whose schema exists only for this call.
 *
 * The schema is empty: callers that need tables run the migrations themselves,
 * which is what makes this usable both for testing the migrations and for
 * testing everything built on top of them.
 */
export async function withTestSchema<T>(
  body: (client: pg.Client, schema: string) => Promise<T>,
): Promise<T> {
  if (!TEST_DATABASE_URL) throw new Error("TEST_DATABASE_URL is not set");

  // Random, not sequential: two suites running at once must not collide, and
  // a leftover from a killed run must not be adopted by the next one.
  const schema = `test_${randomBytes(6).toString("hex")}`;
  const client = new pg.Client(connectionConfig(TEST_DATABASE_URL, schema));
  await client.connect();

  try {
    await client.query(`create schema ${schema}`);
    await client.query(`set search_path to ${schema}`);
    return await body(client, schema);
  } finally {
    // Cascade: the point is to leave nothing, including tables the test made
    // that this code has never heard of.
    await client.query(`drop schema if exists ${schema} cascade`).catch(() => {});
    await client.end();
  }
}

/**
 * The same, with the product's tables already in place.
 *
 * What almost every test above the database wants: a real `accounts` table
 * with its real constraints, and nothing in it.
 */
export async function withMigratedSchema<T>(
  body: (client: pg.Client, schema: string) => Promise<T>,
): Promise<T> {
  // Imported here rather than at the top so that the migration runner is not
  // loaded by tests that never touch a database.
  const { migrateUp } = await import("./migrate");
  return withTestSchema(async (client, schema) => {
    await migrateUp(client, { schema });
    return body(client, schema);
  });
}
