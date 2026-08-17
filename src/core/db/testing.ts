import pg from "pg";
import { env } from "@/core/config/env";
import { migrate } from "@/core/db/migrate";
import { quoteIdent, resetPool } from "@/core/db/client.server";

export function testDatabaseUrl() {
  return env("TEST_DATABASE_URL");
}

export async function withTestSchema<T>(fn: () => Promise<T>) {
  const url = testDatabaseUrl();
  if (!url) return null;
  const schema = `test_${Math.random().toString(16).slice(2, 10)}`;
  const previous = {
    DATABASE_URL: process.env.DATABASE_URL,
    DB_SCHEMA: process.env.DB_SCHEMA,
  };
  process.env.DATABASE_URL = url;
  process.env.DB_SCHEMA = schema;
  const local = url.includes("localhost") || url.includes("127.0.0.1");
  const client = new pg.Client({
    connectionString: url,
    ssl: local ? false : { rejectUnauthorized: false },
  });
  await client.connect();
  try {
    await migrate("up");
    return await fn();
  } finally {
    await resetPool();
    await client.query(`drop schema if exists ${quoteIdent(schema)} cascade`);
    await client.end();
    process.env.DATABASE_URL = previous.DATABASE_URL;
    process.env.DB_SCHEMA = previous.DB_SCHEMA;
  }
}
