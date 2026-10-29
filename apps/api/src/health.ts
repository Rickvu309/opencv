import { readFileSync } from "node:fs"
import path from "node:path"

import { sql } from "drizzle-orm"
import { Hono } from "hono"

import type { AppDatabase } from "./db/context.js"
import { migrationsFolder } from "./db/paths.js"

type DeepHealth = {
  ok: boolean
  sha: string | null
  db: boolean
  mail: boolean
  schemaVersion: string | null
}

type HealthConfig = {
  db?: AppDatabase
  sha: string | null
  mailConfigured: boolean
  dbTimeoutMs: number
}

type JournalEntry = { when: number; tag: string }

/** Drizzle stores each applied migration's journal `when`, not its tag. */
function migrationTag(createdAt: number): string {
  try {
    const journal = JSON.parse(
      readFileSync(path.join(migrationsFolder, "meta/_journal.json"), "utf8")
    ) as { entries: JournalEntry[] }
    return (
      journal.entries.find((entry) => entry.when === createdAt)?.tag ??
      String(createdAt)
    )
  } catch {
    return String(createdAt)
  }
}

async function probeDatabase(
  db: AppDatabase
): Promise<{ db: boolean; schemaVersion: string | null }> {
  try {
    await db.execute(sql`select 1`)
  } catch {
    return { db: false, schemaVersion: null }
  }
  try {
    const result = await db.execute<{ created_at: string }>(
      sql`select created_at from opencv_app.migrations order by created_at desc limit 1`
    )
    const createdAt = result.rows[0]?.created_at
    return {
      db: true,
      schemaVersion: createdAt ? migrationTag(Number(createdAt)) : null,
    }
  } catch {
    return { db: true, schemaVersion: null }
  }
}

async function boundedProbe(db: AppDatabase | undefined, timeoutMs: number) {
  const down = { db: false, schemaVersion: null }
  if (!db) return down
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<typeof down>((resolve) => {
    timer = setTimeout(() => resolve(down), timeoutMs)
  })
  try {
    return await Promise.race([probeDatabase(db), timeout])
  } finally {
    clearTimeout(timer)
  }
}

/**
 * `/health` is Railway's liveness probe: always 200, no dependency checks, so
 * a database blip never fails a deploy. `/health/deep` reports what sign-in
 * needs and answers 503 when something is missing. Booleans only, no values.
 */
export function createHealthRoutes({
  db,
  sha,
  mailConfigured,
  dbTimeoutMs,
}: HealthConfig) {
  const routes = new Hono()
  routes.get("/health", (c) => c.json({ ok: true, sha }))
  routes.get("/health/deep", async (c) => {
    const probe = await boundedProbe(db, dbTimeoutMs)
    const body: DeepHealth = {
      ok: probe.db && mailConfigured,
      sha,
      db: probe.db,
      mail: mailConfigured,
      schemaVersion: probe.schemaVersion,
    }
    return c.json(body, body.ok ? 200 : 503)
  })
  return routes
}
