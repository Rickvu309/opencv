import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { env, schemaName } from "@/core/config/env";
import { quoteIdent } from "@/core/db/client.server";

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "migrations");

type Pair = { n: string; name: string; up: string; down: string };

export async function migrate(mode: "up" | "down" | "status") {
  const url = env("DATABASE_URL");
  if (!url) throw new Error("DATABASE_URL is required");
  const schema = schemaName();
  const local = url.includes("localhost") || url.includes("127.0.0.1");
  const client = new pg.Client({
    connectionString: url,
    ssl: local ? false : { rejectUnauthorized: false },
  });
  await client.connect();
  try {
    console.log(`database ${new URL(url).host} schema ${schema}`);
    await client.query(`create schema if not exists ${quoteIdent(schema)}`);
    await client.query(`set search_path to ${quoteIdent(schema)}, public`);
    await client.query(`
      create table if not exists schema_migrations (
        version text primary key,
        checksum text not null,
        applied_at timestamptz not null default now()
      )
    `);
    const pairs = await loadPairs();
    const applied = await client.query<{ version: string; checksum: string }>(
      "select version, checksum from schema_migrations order by version",
    );
    const map = new Map(applied.rows.map((r) => [r.version, r.checksum]));
    if (mode === "status") {
      for (const p of pairs) {
        const state = map.has(p.n) ? "applied" : "pending";
        console.log(`${p.n}_${p.name} ${state}`);
      }
      return;
    }
    if (mode === "up") {
      for (const p of pairs) {
        const checksum = sha(p.up);
        const existing = map.get(p.n);
        if (existing) {
          if (existing !== checksum) {
            throw new Error(`migration ${p.n} changed after apply`);
          }
          continue;
        }
        await client.query("begin");
        try {
          await client.query(p.up);
          await client.query(
            "insert into schema_migrations (version, checksum) values ($1, $2)",
            [p.n, checksum],
          );
          await client.query("commit");
          console.log(`applied ${p.n}_${p.name}`);
        } catch (error) {
          await client.query("rollback");
          throw error;
        }
      }
      return;
    }
    const last = applied.rows.at(-1);
    if (!last) {
      console.log("nothing to roll back");
      return;
    }
    const pair = pairs.find((p) => p.n === last.version);
    if (!pair) throw new Error(`missing files for ${last.version}`);
    await client.query("begin");
    try {
      await client.query(pair.down);
      await client.query("delete from schema_migrations where version = $1", [
        last.version,
      ]);
      await client.query("commit");
      console.log(`rolled back ${pair.n}_${pair.name}`);
    } catch (error) {
      await client.query("rollback");
      throw error;
    }
  } finally {
    await client.end();
  }
}

async function loadPairs() {
  const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();
  const by = new Map<string, Partial<Pair>>();
  for (const file of files) {
    const match = file.match(/^(\d{3})_([a-z0-9_]+)\.(up|down)\.sql$/);
    if (!match) throw new Error(`bad migration name ${file}`);
    const [, n, name, kind] = match;
    const key = `${n}_${name}`;
    const entry = by.get(key) ?? { n, name };
    const sql = await readFile(path.join(dir, file), "utf8");
    if (kind === "up") entry.up = sql;
    else entry.down = sql;
    by.set(key, entry);
  }
  const pairs: Pair[] = [];
  const seen = new Set<string>();
  for (const [key, value] of by) {
    if (!value.up || !value.down || !value.n || !value.name) {
      throw new Error(`migration ${key} is missing a half`);
    }
    if (seen.has(value.n)) throw new Error(`shared number ${value.n}`);
    seen.add(value.n);
    pairs.push(value as Pair);
  }
  return pairs.sort((a, b) => a.n.localeCompare(b.n));
}

function sha(text: string) {
  return createHash("sha256").update(text).digest("hex");
}
