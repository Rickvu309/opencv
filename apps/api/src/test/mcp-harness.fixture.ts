import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { once } from "node:events"
import { serve } from "@hono/node-server"
import { and, eq, sql } from "drizzle-orm"
import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"
import { z } from "zod"
import { createApp } from "../app.js"
import { runMigrations } from "../db/migrate.js"
import * as schema from "../db/schema.js"

const requestSchema = z.discriminatedUnion("kind", [
  z.object({
    id: z.string(),
    kind: z.literal("person"),
    email: z.string().email(),
  }),
  z.object({ id: z.string(), kind: z.literal("close") }),
  z.object({ id: z.string(), kind: z.literal("wire") }),
  z.object({ id: z.string(), kind: z.literal("observe"), jobId: z.uuid() }),
  z.object({
    id: z.string(),
    kind: z.literal("history"),
    connectionId: z.uuid(),
    mode: z.enum(["seed", "expire"]),
  }),
])
const databaseUrl = z.string().url().parse(process.env.FORMAL_DATABASE_URL)
const name = `mcp_harness_${randomUUID().replaceAll("-", "")}`
const admin = new Pool({ connectionString: databaseUrl, max: 1 })
await admin.query(`CREATE DATABASE ${name}`)
const target = new URL(databaseUrl)
target.pathname = `/${name}`
const pool = new Pool({ connectionString: target.href, max: 8 })
const db = drizzle(pool, { schema })
const codes = new Map<string, string>()
const originalLog = console.log
console.log = (...values: unknown[]) => {
  const line = String(values[0])
  const match = /^\[auth\] email code for (.+) type sign-in: ([0-9]{6})$/.exec(
    line
  )
  if (match?.[1] && match[2]) codes.set(match[1], match[2])
  else originalLog(...values)
}

let server: ReturnType<typeof serve> | undefined
const wire: {
  method: string
  version: string | null
  status: number
  session: string | null
  call: unknown
  contentType: string | null
}[] = []
let closing: Promise<void> | undefined
function close() {
  closing ??= (async () => {
    const listening = server
    if (listening) {
      if ("closeAllConnections" in listening) listening.closeAllConnections()
      await new Promise<void>((resolve, reject) =>
        listening.close((error) => (error ? reject(error) : resolve()))
      )
    }
    await pool.end()
    await admin.query(`DROP DATABASE ${name} WITH (FORCE)`)
    await admin.end()
    console.log = originalLog
  })()
  return closing
}

process.once("disconnect", () => void close())
process.once("SIGTERM", () => void close().then(() => process.exit()))

try {
  await runMigrations(db)
  server = serve({
    hostname: "127.0.0.1",
    port: Number(process.env.MCP_HARNESS_PORT ?? 0),
    fetch: async (request) => {
      const body: unknown =
        request.method === "POST"
          ? await request
              .clone()
              .json()
              .catch(() => null)
          : null
      const response = await app.fetch(request)
      if (new URL(request.url).pathname === "/mcp")
        wire.push({
          method: request.method,
          version: request.headers.get("MCP-Protocol-Version"),
          status: response.status,
          session: response.headers.get("Mcp-Session-Id"),
          call:
            z.object({ method: z.string() }).safeParse(body).data?.method ??
            null,
          contentType: response.headers.get("content-type"),
        })
      return response
    },
  })
  await once(server, "listening")
  const address = server.address()
  assert(address && typeof address !== "string")
  const origin = `http://127.0.0.1:${address.port}`
  const webOrigin = "https://person.opencv.test"
  const app = createApp({
    db,
    authUrl: origin,
    webOrigins: [webOrigin],
    sessionSecret: randomUUID() + randomUUID(),
    rateLimitEnabled: false,
    sendCodeLimitEnabled: false,
    logAuthMail: true,
    coachDurable: false,
  })
  async function jsonPost(path: string, body: unknown) {
    const response = await fetch(new URL(path, origin), {
      method: "POST",
      headers: { Origin: webOrigin, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    assert.equal(response.status, 200, await response.clone().text())
    return response
  }
  process.on("message", async (raw: unknown) => {
    const request = requestSchema.parse(raw)
    try {
      if (request.kind === "wire") {
        process.send?.({ id: request.id, data: wire })
        return
      }
      if (request.kind === "close") {
        await close()
        process.send?.({ id: request.id, data: true })
        process.disconnect?.()
        return
      }
      if (request.kind === "observe") {
        const rows = await db
          .select({ id: schema.activity.id })
          .from(schema.activity)
          .where(
            and(
              eq(schema.activity.subjectId, request.jobId),
              eq(schema.activity.command, "job.setPriority"),
              eq(schema.activity.actor, "delegate")
            )
          )
        process.send?.({ id: request.id, data: rows })
        return
      }
      if (request.kind === "history") {
        const [connection] = await db
          .select()
          .from(schema.agentConnections)
          .where(eq(schema.agentConnections.id, request.connectionId))
        assert(
          connection,
          "The connection belongs to this isolated fixture database"
        )
        if (request.mode === "seed") {
          await db.insert(schema.agentToolCalls).values(
            Array.from({ length: 60 }, () => ({
              userId: connection.userId,
              connectionId: connection.id,
              tool: "job.list",
              inputHash: "seeded-boundary",
              outcome: "success" as const,
              charged: true,
              createdAt: sql`clock_timestamp() - interval '30 seconds'`,
            }))
          )
        } else {
          await db
            .update(schema.agentToolCalls)
            .set({ createdAt: sql`clock_timestamp() - interval '61 seconds'` })
            .where(eq(schema.agentToolCalls.connectionId, connection.id))
        }
        process.send?.({ id: request.id, data: true })
        return
      }
      await jsonPost("/api/auth/email-otp/send-verification-otp", {
        email: request.email,
        type: "sign-in",
      })
      const otp = codes.get(request.email)
      assert(otp, "The local test person's email code was delivered")
      codes.delete(request.email)
      const response = await jsonPost("/api/auth/sign-in/email-otp", {
        email: request.email,
        otp,
        name: "MCP harness person",
      })
      const cookie = response.headers
        .getSetCookie()
        .map((line) => line.split(";")[0])
        .join("; ")
      assert(cookie)
      const sessionResponse = await fetch(`${origin}/api/auth/get-session`, {
        headers: { Cookie: cookie },
      })
      assert.equal(sessionResponse.status, 200)
      const identity = z
        .object({
          user: z.object({ id: z.string() }),
          session: z.object({ id: z.string() }),
        })
        .parse(await sessionResponse.json())
      process.send?.({
        id: request.id,
        data: {
          cookie,
          userId: identity.user.id,
          sessionId: identity.session.id,
        },
      })
    } catch (error) {
      process.send?.({ id: request.id, error: String(error) })
    }
  })
  const version = await pool.query<{ version: string }>("select version()")
  process.send?.({
    ready: {
      origin,
      webOrigin,
      database: name,
      postgres: version.rows[0]?.version,
    },
  })
} catch (error) {
  await close()
  throw error
}
