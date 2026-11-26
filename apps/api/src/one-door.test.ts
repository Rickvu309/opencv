import { describe, expect, it } from "vitest"

import { createMigratedTestDb, createTestApp } from "./test/harness.js"

const doors = ["POST /api/commands/:name", "POST /api/reads/:name"]

const transportExceptions = {
  signIn: [
    "ALL /api/auth/*",
    "GET /api/session",
    "GET /api/public-config",
    "GET /.well-known/oauth-authorization-server",
    "GET /.well-known/oauth-authorization-server/api/auth",
  ],
  agentProtocol: ["ALL /mcp", "GET /.well-known/oauth-protected-resource/mcp"],
  mailProviderRedirect: ["GET /api/inbox/connect", "GET /api/inbox/callback"],
  stream: ["POST /api/chats/:id/turns", "GET /api/coach/tasks/:id/events"],
  upload: [
    "POST /api/account/photo",
    "POST /api/paper/files",
    "POST /api/paper/import",
    "POST /api/paper/letter-attachment",
  ],
  download: [
    "GET /api/account/export",
    "GET /api/paper/:id/native-word",
    "GET /api/paper/files/:id/bytes",
  ],
  health: ["GET /health", "GET /health/deep"],
}

const waitingToBecomeOperations: string[] = []

async function servedRoutes() {
  const { db, client } = await createMigratedTestDb()
  try {
    const app = createTestApp(db)
    await app.request("/api/session")
    const fewestArguments = new Map<string, number>()
    for (const route of app.routes) {
      const key = `${route.method} ${route.path}`
      fewestArguments.set(
        key,
        Math.min(fewestArguments.get(key) ?? 2, route.handler.length)
      )
    }
    return [...fewestArguments]
      .filter(([key, count]) => !key.endsWith("*") || count < 2)
      .map(([key]) => key)
      .sort()
  } finally {
    await client.close()
  }
}

describe("every change and read of product data goes through an operation", () => {
  it("serves only the two doors, the transport exceptions and the routes waiting to become operations", async () => {
    const known = [
      ...doors,
      ...Object.values(transportExceptions).flat(),
      ...waitingToBecomeOperations,
    ].sort()
    expect(new Set(known).size).toBe(known.length)
    expect(
      await servedRoutes(),
      "A new api route must be an operation in the contract, reached through /api/commands or /api/reads. Only sign-in, an agent protocol, a provider redirect, a stream, an upload, a download, a visitor page or a health check may be a route of its own."
    ).toEqual(known)
  })

  it("has no more routes waiting to become operations than it had", () => {
    expect(waitingToBecomeOperations.length).toBeLessThanOrEqual(0)
  })
})
