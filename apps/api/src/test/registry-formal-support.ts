import { randomUUID } from "node:crypto"

import { personActor } from "@workspace/domain"
import { and, count, eq } from "drizzle-orm"
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres"
import { Pool } from "pg"
import { afterAll, beforeAll } from "vitest"
import {} from "zod"

import type { AppDatabase, TestDatabase } from "../db/context.js"
import {} from "../db/context.js"
import { runMigrations } from "../db/migrate.js"
import * as schema from "../db/schema.js"
import {
  activity,
  chats,
  idempotency,
  jobs,
  paperDocs,
  user,
} from "../db/schema.js"
import { createMigratedTestDb } from "./harness.js"
import { CommandError } from "../registry/errors.js"
import { installRegistry } from "../registry/install.js"
import {} from "../registry/registry.js"

// Formal check of the command registry promise under concurrent calls:
//   P1  a keyed command runs its effect once and every caller gets the replay
//   P2  a pending action runs at most once, and approve and deny never both win
//   P3  an activity row is undone at most once, and a row with no reversal is refused
// The expected outcome of every scenario is a literal rule below, never read back
// from the registry. See .claude/skills/verify-command-registry/SKILL.md.

export const SEED = Number(process.env.FORMAL_SEED ?? 241)
export const REAL = Boolean(process.env.FORMAL_DATABASE_URL)
// Findings the registry has today. A caller that fails with one of these
// postgres codes is counted and printed, not accepted silently: the pinned
// `it.fails` tests below go red when the code is fixed.
export const KNOWN_FINDING = {
  issue: "#758",
  pgCode: "25P02",
}

export type Backend = {
  kind: "pglite" | "postgres"
  db: TestDatabase
  close: () => Promise<void>
}

export async function openBackend(): Promise<Backend> {
  const url = process.env.FORMAL_DATABASE_URL
  if (!url) {
    const { db, client } = await createMigratedTestDb()
    return { kind: "pglite", db, close: () => client.close() }
  }
  const name = `formal_${randomUUID().replaceAll("-", "")}`
  const admin = new Pool({ connectionString: url, max: 1 })
  await admin.query(`CREATE DATABASE ${name}`)
  const target = new URL(url)
  target.pathname = `/${name}`
  const pool = new Pool({ connectionString: target.toString(), max: 8 })
  pool.on("error", () => {})
  const db = drizzlePg(pool, { schema })
  await runMigrations(db as unknown as AppDatabase)
  return {
    kind: "postgres",
    db: db as unknown as TestDatabase,
    close: async () => {
      await pool.end()
      await admin.query(`DROP DATABASE ${name}`)
      await admin.end()
    },
  }
}

// Interleaving measurement. A race only exists when two transactions are open
// at once, so every transaction the registry opens is counted and ordered.
export type Trace = {
  requested: number
  active: number
  maxActive: number
  order: string[]
}
export const trace: Trace = { requested: 0, active: 0, maxActive: 0, order: [] }
export const measured: Array<{
  label: string
  requested: number
  maxActive: number
}> = []
export let overallMaxActive = 0

export function instrument(db: TestDatabase) {
  type Tx = Parameters<Parameters<TestDatabase["transaction"]>[0]>[0]
  const target = db as unknown as {
    transaction: (cb: (tx: Tx) => Promise<unknown>) => Promise<unknown>
  }
  const original = target.transaction.bind(db)
  target.transaction = (cb) => {
    const id = ++trace.requested
    return original(async (tx) => {
      trace.active += 1
      trace.maxActive = Math.max(trace.maxActive, trace.active)
      trace.order.push(`+${id}`)
      try {
        return await cb(tx)
      } finally {
        trace.active -= 1
        trace.order.push(`-${id}`)
      }
    })
  }
}

export async function measure<T>(
  label: string,
  fn: () => Promise<T>
): Promise<T> {
  trace.requested = 0
  trace.maxActive = 0
  trace.order = []
  const result = await fn()
  overallMaxActive = Math.max(overallMaxActive, trace.maxActive)
  measured.push({
    label,
    requested: trace.requested,
    maxActive: trace.maxActive,
  })
  return result
}

export function prng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const tick = () => new Promise<void>((resolve) => setImmediate(resolve))

export type Outcome<T> = { ok: true; value: T } | { ok: false; error: unknown }

// Starts every call in the same tick, each after its own number of event-loop
// turns, so the order in which the calls reach the database differs by seed.
export async function race<T>(
  calls: Array<() => Promise<T>>,
  delays: number[]
): Promise<Outcome<T>[]> {
  return Promise.all(
    calls.map(async (call, index) => {
      for (let i = 0; i < (delays[index] ?? 0); i += 1) await tick()
      return call().then(
        (value): Outcome<T> => ({ ok: true, value }),
        (error: unknown): Outcome<T> => ({ ok: false, error })
      )
    })
  )
}

export function pgCodeOf(error: unknown): string | null {
  const seen = new Set<unknown>()
  let current: unknown = error
  while (current && typeof current === "object" && !seen.has(current)) {
    seen.add(current)
    const code = (current as { code?: unknown }).code
    if (typeof code === "string" && /^[0-9A-Z]{5}$/.test(code)) return code
    current = (current as { cause?: unknown }).cause
  }
  return null
}

export function describeError(error: unknown) {
  if (error instanceof CommandError) return `${error.code}: ${error.message}`
  const code = pgCodeOf(error)
  const message = error instanceof Error ? error.message : String(error)
  return `${code ?? "error"}: ${message}`.slice(0, 200)
}

// Only a real server can produce the finding by itself. On PGlite the calls
// never overlap, so the same code there is a bug in the check, not a finding.
export function isKnownFinding(error: unknown) {
  return REAL && pgCodeOf(error) === KNOWN_FINDING.pgCode
}

export function commandErrorOf(outcome: Outcome<unknown>) {
  if (outcome.ok) return null
  return outcome.error instanceof CommandError ? outcome.error : null
}

export let backend: Backend
export const knownFindingHits: string[] = []

export function registerBackendHooks() {
  beforeAll(async () => {
    backend = await openBackend()
    instrument(backend.db)
  }, 120_000)

  afterAll(async () => {
    const hits = knownFindingHits.length
    console.log(
      `[formal] backend=${backend.kind} scenarios=${measured.length} maxConcurrentTransactions=${overallMaxActive} knownFindingHits=${hits}`
    )
    const byLabel = new Map<string, number>()
    for (const row of measured) {
      byLabel.set(
        row.label,
        Math.max(byLabel.get(row.label) ?? 0, row.maxActive)
      )
    }
    for (const [label, max] of byLabel) {
      console.log(`[formal] ${label}: max open transactions ${max}`)
    }
    await backend.close()
  })
}

export const registry = installRegistry()
export const NS = [2, 3, 4]
export const SEEDS = [SEED, SEED + 1, SEED + 2]

export function delaysFor(seed: number, n: number) {
  const next = prng(seed * 31 + n)
  return Array.from({ length: n }, () => Math.floor(next() * 3))
}

export async function newPerson() {
  const id = `formal-${randomUUID()}`
  await backend.db
    .insert(user)
    .values({ id, name: "Ada", email: `${id}@example.com` })
  return { id, person: personActor(id) }
}

export async function rowsOf(
  table: "jobs" | "papers" | "chats",
  userId: string
) {
  const source =
    table === "jobs" ? jobs : table === "papers" ? paperDocs : chats
  const [row] = await backend.db
    .select({ n: count() })
    .from(source)
    .where(eq(source.userId, userId))
  return row?.n ?? 0
}

export async function activityKeyed(userId: string, key: string) {
  return backend.db
    .select()
    .from(activity)
    .where(and(eq(activity.userId, userId), eq(activity.idempotencyKey, key)))
}

export async function storedKeyed(userId: string, key: string) {
  return backend.db
    .select()
    .from(idempotency)
    .where(and(eq(idempotency.userId, userId), eq(idempotency.key, key)))
}

export function noteCaller(label: string, outcome: Outcome<unknown>) {
  if (!outcome.ok && isKnownFinding(outcome.error)) {
    knownFindingHits.push(label)
  }
}
