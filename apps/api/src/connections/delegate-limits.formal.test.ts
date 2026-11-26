import { randomUUID } from "node:crypto"
import { delegateActorSchema } from "@workspace/domain/kernel"
import { count, eq, sql } from "drizzle-orm"
import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"
import { afterAll, beforeAll, expect, it } from "vitest"
import { getDb, transaction, withDatabase } from "../db/context.js"
import { runMigrations } from "../db/migrate.js"
import * as schema from "../db/schema.js"
import { requireLiveDelegate } from "../registry/delegate-policy.js"
import { appendDelegateCall, delegateCallWindow } from "./call-store.js"

const url = process.env.FORMAL_DATABASE_URL
const databaseName = `formal_limiter_${randomUUID().replaceAll("-", "")}`
let admin: Pool
let pools: [Pool, Pool]
let databases: [
  ReturnType<typeof drizzle<typeof schema>>,
  ReturnType<typeof drizzle<typeof schema>>,
]

beforeAll(async () => {
  if (!url) return
  admin = new Pool({ connectionString: url, max: 1 })
  await admin.query(`CREATE DATABASE ${databaseName}`)
  const target = new URL(url)
  target.pathname = `/${databaseName}`
  pools = [
    new Pool({ connectionString: target.href, max: 1 }),
    new Pool({ connectionString: target.href, max: 1 }),
  ]
  databases = [drizzle(pools[0], { schema }), drizzle(pools[1], { schema })]
  await runMigrations(databases[0])
}, 30_000)

afterAll(async () => {
  if (!url) return
  await Promise.all(pools.map((pool) => pool.end()))
  await admin.query(`DROP DATABASE ${databaseName}`)
  await admin.end()
})

async function actor(owner: string = randomUUID()) {
  const id = randomUUID(),
    clientId = randomUUID()
  await databases[0]
    .insert(schema.user)
    .values({ id: owner, name: "Formal", email: `${owner}@example.com` })
    .onConflictDoNothing()
  await databases[0].insert(schema.oauthClient).values({
    id: randomUUID(),
    clientId,
    redirectUris: ["http://localhost/callback"],
    disabled: false,
  })
  await databases[0].insert(schema.agentConnections).values({
    id,
    userId: owner,
    clientId,
    authorizationCodeId: randomUUID(),
    name: "Formal",
    audience: "https://api.opencv.me/mcp",
    scopes: ["connection.status", "job.read", "job.write"],
    resources: { kind: "jobs" },
    policy: { reads: "allow", writes: "approval" },
    expiresAt: new Date(Date.now() + 3_600_000),
  })
  return delegateActorSchema.parse({
    type: "delegate",
    userId: owner,
    connectionId: id,
    name: "Formal",
    scopes: ["connection.status", "job.read", "job.write"],
    resources: "jobs",
    reads: "allow",
    writes: "approval",
  })
}

async function seed(
  delegate: Awaited<ReturnType<typeof actor>>,
  amount: number
) {
  await databases[0].insert(schema.agentToolCalls).values(
    Array.from({ length: amount }, () => ({
      userId: delegate.userId,
      connectionId: delegate.connectionId,
      tool: "job.list",
      inputHash: "seed",
      outcome: "success" as const,
      charged: true,
    }))
  )
}

function attempt(
  db: (typeof databases)[number],
  delegate: Awaited<ReturnType<typeof actor>>
) {
  return withDatabase(db, () =>
    transaction(async () => {
      const window = await delegateCallWindow(delegate)
      await requireLiveDelegate(delegate)
      if (window.allowed)
        await getDb().insert(schema.jobs).values({
          id: randomUUID(),
          userId: delegate.userId,
          title: "Effect",
          company: "Formal",
          position: randomUUID(),
        })
      await appendDelegateCall({
        actor: delegate,
        tool: "job.list",
        input: {},
        window,
        outcome: window.allowed ? "success" : "limited",
      })
      return window.allowed
    })
  )
}

it.skipIf(!url)(
  "two Postgres sessions admit one sixtieth call and no sixty-first effect",
  async () => {
    const firstPid = await pools[0].query("select pg_backend_pid() as pid")
    const secondPid = await pools[1].query("select pg_backend_pid() as pid")
    expect(firstPid.rows[0]?.pid).not.toBe(secondPid.rows[0]?.pid)
    const delegate = await actor()
    await seed(delegate, 59)
    expect(
      (await Promise.all(databases.map((db) => attempt(db, delegate)))).sort()
    ).toEqual([false, true])
    const rows = await databases[0]
      .select()
      .from(schema.agentToolCalls)
      .where(eq(schema.agentToolCalls.userId, delegate.userId))
    expect(rows.filter((row) => row.charged)).toHaveLength(60)
    expect(rows.filter((row) => row.outcome === "limited")).toHaveLength(1)
    expect(
      await databases[0]
        .select({ n: count() })
        .from(schema.jobs)
        .where(eq(schema.jobs.userId, delegate.userId))
    ).toEqual([{ n: 1 }])
  }
)

it.skipIf(!url)(
  "different connections serialize the one-hundred-twentieth owner call",
  async () => {
    const first = await actor(),
      second = await actor(first.userId)
    const third = await actor(first.userId),
      fourth = await actor(first.userId)
    await seed(first, 60)
    await seed(second, 59)
    expect(
      (
        await Promise.all([
          attempt(databases[0], third),
          attempt(databases[1], fourth),
        ])
      ).sort()
    ).toEqual([false, true])
    expect(await attempt(databases[1], await actor())).toBe(true)
  }
)

it.skipIf(!url)(
  "database time expires the rolling window and a revoked connection has no effect",
  async () => {
    const delegate = await actor()
    await seed(delegate, 60)
    expect(await attempt(databases[1], delegate)).toBe(false)
    await databases[0]
      .update(schema.agentToolCalls)
      .set({ createdAt: sql`clock_timestamp() - interval '61 seconds'` })
      .where(eq(schema.agentToolCalls.connectionId, delegate.connectionId))
    expect(await attempt(databases[1], delegate)).toBe(true)
    await databases[0]
      .update(schema.agentConnections)
      .set({ revokedAt: new Date() })
      .where(eq(schema.agentConnections.id, delegate.connectionId))
    await expect(attempt(databases[1], delegate)).rejects.toThrow(
      "no longer active"
    )
    expect(
      await databases[0]
        .select({ n: count() })
        .from(schema.agentToolCalls)
        .where(eq(schema.agentToolCalls.connectionId, delegate.connectionId))
    ).toEqual([{ n: 62 }])
    expect(
      await databases[0]
        .select({ n: count() })
        .from(schema.jobs)
        .where(eq(schema.jobs.userId, delegate.userId))
    ).toEqual([{ n: 1 }])
  }
)
