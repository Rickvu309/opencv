import pg from "pg";
import { env, schemaName } from "@/core/config/env";

let pool: pg.Pool | undefined;

export async function resetPool() {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}

export function databaseUrl() {
  return env("DATABASE_URL");
}

export function getPool() {
  const url = databaseUrl();
  if (!url) throw new Error("DATABASE_URL is required");
  if (!pool) {
    const local = url.includes("localhost") || url.includes("127.0.0.1");
    pool = new pg.Pool({
      connectionString: url,
      ssl: local ? false : { rejectUnauthorized: false },
    });
  }
  return pool;
}

export async function withClient<T>(fn: (client: pg.PoolClient) => Promise<T>) {
  const client = await getPool().connect();
  try {
    await client.query(`set search_path to ${quoteIdent(schemaName())}, public`);
    return await fn(client);
  } finally {
    client.release();
  }
}

export async function withTx<T>(fn: (client: pg.PoolClient) => Promise<T>) {
  return withClient(async (client) => {
    await client.query("begin");
    try {
      const result = await fn(client);
      await client.query("commit");
      return result;
    } catch (error) {
      await client.query("rollback");
      throw error;
    }
  });
}

export function quoteIdent(value: string) {
  if (!/^[a-z_][a-z0-9_]*$/i.test(value)) {
    throw new Error(`unsafe identifier: ${value}`);
  }
  return `"${value}"`;
}
