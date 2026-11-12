import { randomUUID } from "node:crypto"
import { serve } from "@hono/node-server"
import { personActor } from "@workspace/domain"
import { eq, sql } from "drizzle-orm"
import { afterAll, afterEach, beforeAll, expect, it, vi } from "vitest"
import { z } from "zod"
import { createApp } from "../app.js"
import { withDatabase } from "../db/context.js"
import {
  agentConnections,
  agentToolCalls,
  jobs,
  oauthAccessToken,
  oauthClient,
  pendingActions,
  user,
} from "../db/schema.js"
import { inputHash } from "../registry/receipt.js"
import { registry } from "../registry/registry.js"
import {
  createMigratedTestDb,
  testSessionSecret,
  testWebOrigin,
} from "../test/harness.js"
import * as callStore from "./call-store.js"
import { hashAgentToken } from "./oauth.js"

let database: Awaited<ReturnType<typeof createMigratedTestDb>>
let server: ReturnType<typeof serve>
let apps: Array<ReturnType<typeof createApp>>
let origin: string
let nextApp = 0
const scopes = ["connection.status", "job.read", "job.write"]
const resultSchema = z.object({
  result: z.object({
    isError: z.boolean().optional(),
    content: z.array(z.object({ type: z.literal("text"), text: z.string() })),
  }),
})

function application() {
  return createApp({
    db: database.db,
    authUrl: origin,
    sessionSecret: testSessionSecret,
    webOrigins: [testWebOrigin],
    rateLimitEnabled: false,
    sendCodeLimitEnabled: false,
  })
}

beforeAll(async () => {
  database = await createMigratedTestDb()
  server = serve({
    port: Number(process.env.MCP_LIMIT_TEST_PORT ?? 0),
    hostname: "127.0.0.1",
    fetch: (request) => {
      const app = apps[nextApp++ % apps.length]
      if (!app) throw new Error("Missing application")
      return app.fetch(request)
    },
  })
  await new Promise<void>((resolve) => server.once("listening", resolve))
  const address = server.address()
  if (!address || typeof address === "string") throw new Error("Missing port")
  origin = `http://127.0.0.1:${address.port}`
  apps = [application(), application()]
}, 30_000)

afterEach(() => vi.restoreAllMocks())
afterAll(async () => {
  if (
    "closeAllConnections" in server &&
    typeof server.closeAllConnections === "function"
  )
    server.closeAllConnections()
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve()))
  )
  await database.client.close()
})

async function connection(owner: string = randomUUID()) {
  await database.db
    .insert(user)
    .values({ id: owner, name: "Caller", email: `${owner}@example.com` })
    .onConflictDoNothing()
  const id = randomUUID(),
    clientId = randomUUID(),
    code = randomUUID(),
    token = randomUUID()
  await database.db.insert(oauthClient).values({
    id: randomUUID(),
    clientId,
    redirectUris: ["http://localhost/callback"],
    disabled: false,
  })
  await database.db.insert(agentConnections).values({
    id,
    userId: owner,
    clientId,
    authorizationCodeId: code,
    name: "Limiter",
    audience: `${origin}/mcp`,
    scopes,
    resources: { kind: "jobs" },
    policy: { reads: "allow", writes: "approval" },
    expiresAt: new Date(Date.now() + 3_600_000),
  })
  await database.db.insert(oauthAccessToken).values({
    id: randomUUID(),
    token: hashAgentToken(token),
    userId: owner,
    clientId,
    authorizationCodeId: code,
    resources: [`${origin}/mcp`],
    scopes,
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 3_600_000),
  })
  return { id, owner, token }
}

async function post(
  caller: Awaited<ReturnType<typeof connection>>,
  name = "job_list",
  input = {}
) {
  const response = await fetch(`${origin}/mcp`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${caller.token}`,
      Accept: "application/json, text/event-stream",
      "Content-Type": "application/json",
      "MCP-Protocol-Version": "2026-07-28",
      "Mcp-Method": "tools/call",
      "Mcp-Name": name,
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: randomUUID(),
      method: "tools/call",
      params: {
        name,
        arguments: input,
        _meta: {
          "io.modelcontextprotocol/protocolVersion": "2026-07-28",
          "io.modelcontextprotocol/clientInfo": {
            name: "Limiter",
            version: "1",
          },
          "io.modelcontextprotocol/clientCapabilities": {},
        },
      },
    }),
  })
  return { status: response.status, text: await response.text() }
}

async function call(
  caller: Awaited<ReturnType<typeof connection>>,
  name = "job_list",
  input = {}
) {
  const response = await post(caller, name, input)
  expect(response.status).toBe(200)
  const body = response.text.startsWith("data:")
    ? response.text.slice(5).trim()
    : response.text
  return resultSchema.parse(JSON.parse(body)).result
}

async function history(caller: Awaited<ReturnType<typeof connection>>) {
  return database.db
    .select()
    .from(agentToolCalls)
    .where(eq(agentToolCalls.connectionId, caller.id))
}

async function seedCalls(
  caller: Awaited<ReturnType<typeof connection>>,
  count: number,
  ageMs: number
) {
  await database.db.insert(agentToolCalls).values(
    Array.from({ length: count }, () => ({
      userId: caller.owner,
      connectionId: caller.id,
      tool: "job.list",
      inputHash: "seed",
      outcome: "success" as const,
      charged: true,
      createdAt: sql`clock_timestamp() - ${ageMs} * interval '1 millisecond'`,
    }))
  )
}

it("shares sixty calls across applications and a restart, without a product access on denial", async () => {
  const caller = await connection()
  for (let index = 0; index < 60; index += 1)
    expect((await call(caller)).isError).not.toBe(true)
  apps = [application(), application()]
  const read = vi.spyOn(registry, "read"),
    execute = vi.spyOn(registry, "execute")
  const started = performance.now()
  const denied = await call(caller)
  expect(performance.now() - started).toBeLessThan(5000)
  expect(denied.isError).toBe(true)
  expect(denied.content[0]?.text).toContain("rate limit")
  expect(read).not.toHaveBeenCalled()
  expect(execute).not.toHaveBeenCalled()
  const rows = await history(caller)
  expect(rows.filter((row) => row.charged)).toHaveLength(60)
  expect(
    rows.filter((row) => row.outcome === "limited" && !row.charged)
  ).toHaveLength(1)
}, 30_000)

it("counts persisted calls within the rolling minute and permits expired calls", async () => {
  const caller = await connection()
  await seedCalls(caller, 59, 2000)
  expect((await call(caller)).isError).not.toBe(true)
  expect((await call(caller)).isError).toBe(true)
  await database.db
    .update(agentToolCalls)
    .set({ createdAt: sql`clock_timestamp() - interval '61 seconds'` })
    .where(eq(agentToolCalls.connectionId, caller.id))
  expect((await call(caller)).isError).not.toBe(true)
})

it("shares the owner cap across connections and isolates other owners", async () => {
  const first = await connection(),
    second = await connection(first.owner),
    third = await connection(first.owner)
  await seedCalls(first, 60, 1000)
  await seedCalls(second, 60, 1000)
  expect((await call(third)).isError).toBe(true)
  expect((await call(await connection())).isError).not.toBe(true)
})

it("records private input as a hash, links the proposal and exposes the safe activity row", async () => {
  const caller = await connection(),
    jobId = randomUUID()
  await database.db.insert(jobs).values({
    id: jobId,
    userId: caller.owner,
    title: "Private Job",
    company: "Company",
    position: "a0",
  })
  const input = { jobId, patch: { description: "Private CV body" } }
  expect((await call(caller, "job_update", input)).isError).not.toBe(true)
  const [row] = await history(caller)
  expect(row).toMatchObject({
    outcome: "pending",
    tool: "job.update",
    charged: true,
  })
  expect(row?.inputHash).toBe(inputHash(input))
  const pending = await database.db
    .select()
    .from(pendingActions)
    .where(eq(pendingActions.userId, caller.owner))
  expect(pending).toHaveLength(1)
  expect(row?.proposalId).toBe(pending[0]?.id)
  const feed = await withDatabase(database.db, () =>
    registry.read("activity.list", {}, personActor(caller.owner))
  )
  expect(feed).toContainEqual(
    expect.objectContaining({
      id: row?.id,
      actor: "delegate",
      subjectId: caller.id,
      reversible: false,
    })
  )
  expect(JSON.stringify(row)).not.toContain("Private CV body")
  expect(JSON.stringify(feed)).not.toContain("Private CV body")
  expect(JSON.stringify(row)).not.toContain(caller.token)
  expect(
    await withDatabase(database.db, () =>
      registry.read(
        "activity.list",
        { subjectId: "plain-text-id" },
        personActor(caller.owner)
      )
    )
  ).toEqual([])
})

it("rolls a proposal back when its audit append fails", async () => {
  const caller = await connection(),
    jobId = randomUUID()
  await database.db.insert(jobs).values({
    id: jobId,
    userId: caller.owner,
    title: "Private Job",
    company: "Company",
    position: "a0",
  })
  vi.spyOn(callStore, "appendDelegateCall").mockRejectedValueOnce(
    new Error("audit unavailable")
  )
  const result = await call(caller, "job_update", {
    jobId,
    patch: { description: "New private note" },
  })
  expect(result.isError).toBe(true)
  expect(result.content[0]?.text).not.toContain("audit unavailable")
  expect(JSON.parse(result.content[0]!.text)).toMatchObject({ code: "failed" })
  expect(await history(caller)).toHaveLength(0)
  expect(
    await database.db
      .select()
      .from(pendingActions)
      .where(eq(pendingActions.userId, caller.owner))
  ).toHaveLength(0)
})

it("audits a product failure and gives a removed connection zero product reads or writes", async () => {
  const caller = await connection()
  expect((await call(caller, "job_get", { jobId: randomUUID() })).isError).toBe(
    true
  )
  expect(await history(caller)).toMatchObject([
    { outcome: "error", charged: true },
  ])
  await database.db
    .update(agentConnections)
    .set({ revokedAt: new Date() })
    .where(eq(agentConnections.id, caller.id))
  const read = vi.spyOn(registry, "read"),
    execute = vi.spyOn(registry, "execute")
  expect((await post(caller)).status).toBe(401)
  expect(read).not.toHaveBeenCalled()
  expect(execute).not.toHaveBeenCalled()
  expect(await history(caller)).toHaveLength(1)
})
