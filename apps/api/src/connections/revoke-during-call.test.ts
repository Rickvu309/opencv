import { randomUUID } from "node:crypto"
import { serve } from "@hono/node-server"
import { afterAll, beforeAll, expect, it } from "vitest"
import { eq } from "drizzle-orm"
import { personActor } from "@workspace/domain"
import { createApp } from "../app.js"
import {
  createMigratedTestDb,
  testSessionSecret,
  testWebOrigin,
} from "../test/harness.js"
import { withDatabase } from "../db/context.js"
import {
  agentConnections,
  oauthAccessToken,
  oauthClient,
  oauthRefreshToken,
  pendingActions,
  user,
} from "../db/schema.js"
import {
  assertRefreshGrant,
  authenticateAgent,
  hashAgentToken,
} from "./oauth.js"
import { idOf } from "../registry/coverage-helpers.test-support.js"
import { registry } from "../registry/registry.js"

let database: Awaited<ReturnType<typeof createMigratedTestDb>>
let server: ReturnType<typeof serve>
let origin: string
const owner = "revoke-during-call"
const person = personActor(owner)
const scopes = ["connection.status", "job.read", "job.write"]

beforeAll(async () => {
  database = await createMigratedTestDb()
  server = serve({
    port: 0,
    hostname: "127.0.0.1",
    fetch: (request) => app.fetch(request),
  })
  await new Promise<void>((resolve) => server.once("listening", resolve))
  const address = server.address()
  if (!address || typeof address === "string")
    throw new Error("Missing server port")
  origin = `http://127.0.0.1:${address.port}`
  app = createApp({
    db: database.db,
    authUrl: origin,
    sessionSecret: testSessionSecret,
    webOrigins: [testWebOrigin],
    rateLimitEnabled: false,
    sendCodeLimitEnabled: false,
  })
  await database.db.insert(user).values({
    id: owner,
    name: "Verifier",
    email: "revoke-during-call@example.com",
  })
}, 30000)

let app: ReturnType<typeof createApp>

afterAll(async () => {
  if (server && "closeAllConnections" in server) server.closeAllConnections()
  if (server)
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve()))
    )
  await database?.client.close()
})

const inDb = <T>(fn: () => Promise<T>) => withDatabase(database.db, fn)

async function connection() {
  const id = randomUUID()
  const clientId = randomUUID()
  const code = randomUUID()
  const token = randomUUID()
  const refresh = randomUUID()
  const expiresAt = new Date(Date.now() + 3_600_000)
  await database.db.insert(oauthClient).values({
    id: randomUUID(),
    clientId,
    redirectUris: ["http://127.0.0.1/callback"],
    disabled: false,
  })
  await database.db.insert(agentConnections).values({
    id,
    userId: owner,
    clientId,
    authorizationCodeId: code,
    name: "Verifier",
    audience: `${origin}/mcp`,
    scopes,
    resources: { kind: "jobs" },
    policy: { reads: "allow", writes: "approval" },
    expiresAt,
  })
  await database.db.insert(oauthRefreshToken).values({
    id: randomUUID(),
    token: hashAgentToken(refresh),
    clientId,
    userId: owner,
    authorizationCodeId: code,
    scopes,
    expiresAt,
    createdAt: new Date(),
  })
  await database.db.insert(oauthAccessToken).values({
    id: randomUUID(),
    token: hashAgentToken(token),
    clientId,
    userId: owner,
    authorizationCodeId: code,
    resources: [`${origin}/mcp`],
    scopes,
    expiresAt,
    createdAt: new Date(),
  })
  return { id, token, refresh }
}

async function job() {
  const created = await inDb(() =>
    registry.execute({
      name: "job.create",
      input: { title: "Private Job", company: "Example", location: "Hanoi" },
      actor: person,
      idempotencyKey: randomUUID(),
    })
  )
  return idOf(created.output)
}

function pauseNextToolList() {
  let entered!: () => void
  let release!: () => void
  const seen = new Promise<void>((resolve) => {
    entered = resolve
  })
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  const original = registry.tools.bind(registry)
  registry.tools = async (actor) => {
    const entries = await original(actor)
    registry.tools = original
    entered()
    await gate
    return entries
  }
  return {
    seen,
    release: () => release(),
  }
}

async function rawTool(
  token: string,
  name: string,
  args: Record<string, unknown>
) {
  const response = await fetch(`${origin}/mcp`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json, text/event-stream",
      "Content-Type": "application/json",
      "MCP-Protocol-Version": "2026-07-28",
      "Mcp-Method": "tools/call",
      "Mcp-Name": name,
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: {
        name,
        arguments: args,
        _meta: {
          "io.modelcontextprotocol/protocolVersion": "2026-07-28",
          "io.modelcontextprotocol/clientInfo": {
            name: "Verifier",
            version: "1",
          },
          "io.modelcontextprotocol/clientCapabilities": {},
        },
      },
    }),
  })
  expect(response.status).toBe(200)
  const text = await response.text()
  const envelope = JSON.parse(
    text.startsWith("data:") ? text.slice(5).trim() : text
  ) as {
    error?: unknown
    result?: { content?: Array<{ text?: string }> }
  }
  expect(envelope.error).toBeUndefined()
  return envelope.result?.content?.[0]?.text ?? ""
}

const revoke = (id: string) =>
  inDb(() =>
    registry.execute({
      name: "connections.revoke",
      input: { connectionId: id },
      actor: person,
      idempotencyKey: randomUUID(),
    })
  )

async function callAfterRevoke(
  token: string,
  connectionId: string,
  name: string,
  args: Record<string, unknown>
) {
  const latch = pauseNextToolList()
  const call = rawTool(token, name, args)
  await latch.seen
  await revoke(connectionId)
  latch.release()
  return call
}

it("refuses a job read that was authenticated before the remove saved", async () => {
  const linked = await connection()
  const jobId = await job()
  const text = await callAfterRevoke(linked.token, linked.id, "job_get", {
    jobId,
  })
  expect(text).not.toContain("Private Job")
  expect(text).toContain("no longer active")
  expect(
    await inDb(() =>
      authenticateAgent(`Bearer ${linked.token}`, `${origin}/mcp`)
    )
  ).toBeNull()
  await expect(
    inDb(() => assertRefreshGrant(linked.refresh))
  ).rejects.toBeDefined()
})

it("does not create a proposal for a write that was waiting on the remove", async () => {
  const linked = await connection()
  const jobId = await job()
  const text = await callAfterRevoke(
    linked.token,
    linked.id,
    "job_setPriority",
    { jobId, priority: "high" }
  )
  expect(text).not.toContain("pendingActionId")
  expect(text).toContain("no longer active")
  const proposals = await database.db
    .select()
    .from(pendingActions)
    .where(eq(pendingActions.delegateConnectionId, linked.id))
  expect(proposals).toEqual([])
  const stored = await inDb(() => registry.read("job.get", { jobId }, person))
  expect(stored).toMatchObject({ priority: "normal" })
})
