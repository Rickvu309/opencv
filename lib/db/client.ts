import { Pool, type PoolConfig } from "pg";

/**
 * The connection to Postgres, and the one place its configuration is decided.
 *
 * ## Why a second store, when the waiting list uses Blob
 *
 * `lib/waitlist/store.ts` argues that a few hundred addresses need no schema and
 * no connection pool. That argument holds, and it stops exactly where accounts
 * begin. A username has to be unique against every other username at the moment
 * it is claimed, and two people claiming the same name in the same second must
 * not both win. That is a constraint the database enforces or nobody does, and
 * blob storage cannot enforce it. So this arrives with accounts, not before.
 *
 * ## Why a named schema rather than `public`
 *
 * The Railway instance already holds the tables of an earlier version of this
 * product, including one called `app_state`. Dropping them to free the name
 * would destroy data this codebase never wrote and cannot judge. Everything
 * this version owns therefore lives in its own schema, and `public` is left as
 * it was found. The tests use the same mechanism with a throwaway name, so a
 * test run cannot touch real rows even though it points at the real instance.
 *
 * ## Why the connection is not verified end to end
 *
 * Railway fronts the database with a TCP proxy and a self-signed certificate.
 * `rejectUnauthorized: true` therefore fails, and the honest reading is that we
 * get encryption without proof of who is on the other end. That is worse than a
 * verified channel and far better than the plaintext alternative, which is what
 * `pg` does when `ssl` is left unset. Measured against this instance: TLSv1.3
 * with the flag off, no TLS at all with no flag.
 */

/** Where this version's tables live. Never `public`; see above. */
const DEFAULT_SCHEMA = "openpath";

/**
 * A schema name goes into SQL that cannot be parameterised, so it is checked
 * rather than trusted. It arrives from the environment, which is not user
 * input, but the cost of being wrong here is arbitrary SQL and the cost of
 * checking is one regular expression.
 */
const SAFE_NAME = /^[a-z_][a-z0-9_]*$/;

export function assertSafeSchema(name: string): string {
  if (!SAFE_NAME.test(name)) {
    throw new Error(
      `Unusable schema name ${JSON.stringify(name)}: lowercase letters, digits and underscore only.`,
    );
  }
  return name;
}

export function schemaName(): string {
  return assertSafeSchema(process.env.DB_SCHEMA ?? DEFAULT_SCHEMA);
}

/**
 * The connection string, or a failure that names what is missing.
 *
 * Deliberately loud. A missing URL surfaces as "cannot connect" on whatever
 * screen happened to need the database first, hours after the deploy that
 * forgot it, and the message the operator needs is the name of the variable.
 */
export function databaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return url;
}

/**
 * TLS settings for a connection string.
 *
 * Loopback is the local-development case: no proxy, no certificate, and asking
 * for TLS there fails the connection rather than securing it.
 */
export function sslFor(url: string): PoolConfig["ssl"] {
  try {
    const { hostname } = new URL(url);
    if (hostname === "localhost" || hostname === "127.0.0.1") return undefined;
  } catch {
    // An unparseable URL is the driver's problem to report, not ours to guess
    // at. Treat it as remote, which is the safer of the two defaults.
  }
  return { rejectUnauthorized: false };
}

/**
 * Everything a connection needs, in one place, so the pool below and the
 * one-shot clients used by the migration CLI and the tests cannot drift.
 */
export function connectionConfig(
  url: string = databaseUrl(),
  schema: string = schemaName(),
): PoolConfig {
  return {
    connectionString: url,
    ssl: sslFor(url),
    // The database is in Southeast Asia and the app is not. A connection that
    // is merely slow must still fail eventually, or a request hangs until the
    // platform kills it and the user sees nothing at all.
    connectionTimeoutMillis: 10_000,
    // Small on purpose. Every serverless instance keeps its own pool, so the
    // number that matters is instances times this, against one Postgres.
    max: 3,
    idleTimeoutMillis: 10_000,
    options: `-c search_path=${schema},public`,
  };
}

/**
 * One pool per process, cached on `globalThis` so a dev-server reload reuses it.
 * Without that, every edit to a server file leaks a pool and the connection
 * limit is reached by lunchtime.
 */
const cache = globalThis as typeof globalThis & { openpathPool?: Pool };

export function getPool(): Pool {
  if (!cache.openpathPool) {
    const pool = new Pool(connectionConfig());
    // An idle client that dies (a proxy restart, a deploy on Railway) emits an
    // error on the pool with nobody awaiting it, and an unhandled 'error' event
    // takes the process down. The next checkout opens a fresh connection, so
    // there is nothing to do here but refuse to crash.
    pool.on("error", (error) => console.error("postgres: idle client", error));
    cache.openpathPool = pool;
  }
  return cache.openpathPool;
}

/** Run a statement and get the rows. The shape every caller wants. */
export async function query<T extends Record<string, unknown>>(
  text: string,
  params?: unknown[],
): Promise<T[]> {
  const result = await getPool().query<T>(text, params);
  return result.rows;
}
