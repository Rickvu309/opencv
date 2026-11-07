import { randomUUID } from "node:crypto"
import { serve } from "@hono/node-server"
import { afterAll, beforeAll, expect, it } from "vitest"
import { createApp } from "../app.js"
import {
  agentConnections,
  oauthAccessToken,
  oauthClient,
  user,
} from "../db/schema.js"
import {
  createMigratedTestDb,
  testSessionSecret,
  testWebOrigin,
} from "../test/harness.js"
import { hashAgentToken } from "./oauth.js"

let app: ReturnType<typeof createApp>
let server: ReturnType<typeof serve>
let database: Awaited<ReturnType<typeof createMigratedTestDb>>
let origin: string

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
    logAuthMail: true,
  })
}, 30000)

afterAll(async () => {
  if ("closeAllConnections" in server) server.closeAllConnections()
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve()))
  )
  await database.client.close()
})

const envelope = {
  "io.modelcontextprotocol/protocolVersion": "2026-07-28",
  "io.modelcontextprotocol/clientInfo": { name: "probe", version: "1" },
  "io.modelcontextprotocol/clientCapabilities": {},
}

function post(headers: Record<string, string>, body?: string) {
  return fetch(`${origin}/mcp`, { method: "POST", headers, body })
}

it("lets a computer with no site name through and turns away another site", async () => {
  expect((await post({})).status).toBe(401)
  expect((await post({ Origin: "http://127.0.0.1:9" })).status).toBe(403)
  expect((await post({ Origin: testWebOrigin })).status).toBe(401)
  expect((await post({ Origin: "https://attacker.example" })).status).toBe(403)
})

it("rejects a website origin whose scheme, host or port is not configured", async () => {
  const authUrl = "https://api.opencv.me"
  const website = "https://opencv.me"
  const configured = createApp({
    db: database.db,
    authUrl,
    sessionSecret: testSessionSecret,
    webOrigins: [website],
    rateLimitEnabled: false,
    sendCodeLimitEnabled: false,
    logAuthMail: true,
  })
  const probe = (origin?: string) =>
    configured.request(`${authUrl}/mcp`, {
      method: "POST",
      headers: {
        Host: "api.opencv.me",
        ...(origin ? { Origin: origin } : {}),
      },
    })
  expect((await probe()).status).toBe(401)
  expect((await probe(website)).status).toBe(401)
  expect((await probe("cursor://session")).status).toBe(401)
  expect((await probe("http://opencv.me")).status).toBe(403)
  expect((await probe("https://opencv.me:4444")).status).toBe(403)
  expect((await probe("http://localhost:9999")).status).toBe(403)
  expect((await probe(authUrl)).status).toBe(403)
  expect((await probe("https://attacker.example")).status).toBe(403)
})

it("rejects a method header that does not match the body", async () => {
  const token = "door-token"
  const audience = `${origin}/mcp`
  const userId = "user-mcp-door"
  const clientId = "client-mcp-door"
  const codeId = randomUUID()
  await database.db.insert(user).values({
    id: userId,
    name: "Door",
    email: "mcp-door@example.com",
  })
  await database.db.insert(oauthClient).values({
    id: randomUUID(),
    clientId,
    redirectUris: ["http://127.0.0.1/callback"],
    disabled: false,
  })
  await database.db.insert(agentConnections).values({
    id: randomUUID(),
    userId,
    clientId,
    authorizationCodeId: codeId,
    name: "Door",
    audience,
    scopes: ["connection.status", "job.read", "job.write"],
    resources: { kind: "jobs" },
    policy: { reads: "allow", writes: "approval" },
    expiresAt: new Date(Date.now() + 60_000),
  })
  await database.db.insert(oauthAccessToken).values({
    id: randomUUID(),
    token: hashAgentToken(token),
    clientId,
    userId,
    authorizationCodeId: codeId,
    resources: [audience],
    expiresAt: new Date(Date.now() + 60_000),
    createdAt: new Date(),
    scopes: ["connection.status", "job.read", "job.write"],
  })
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/json, text/event-stream",
    "Content-Type": "application/json",
    "MCP-Protocol-Version": "2026-07-28",
  }
  const body = (id: number, method: string) =>
    JSON.stringify({
      jsonrpc: "2.0",
      id,
      method,
      params: { _meta: envelope },
    })
  const mismatch = await post(
    { ...headers, "Mcp-Method": "tools/call" },
    body(1, "tools/list")
  )
  expect(mismatch.status).toBe(400)
  expect(await mismatch.json()).toMatchObject({ error: { code: -32020 } })
  expect(
    (
      await post(
        { ...headers, "Mcp-Method": "tools/list" },
        body(2, "tools/list")
      )
    ).status
  ).not.toBe(403)
  expect(
    (
      await post(
        {
          ...headers,
          "Mcp-Method": "tools/list",
          Origin: "cursor://session",
        },
        body(3, "tools/list")
      )
    ).status
  ).not.toBe(403)
})
