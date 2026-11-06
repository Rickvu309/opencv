import { Hono } from "hono"
import { McpServer, createMcpHandler } from "@modelcontextprotocol/server"
import { oauthProviderAuthServerMetadata } from "@better-auth/oauth-provider"
import { personActor, successEnvelope } from "@workspace/domain"
import type { Auth } from "../auth.js"
import type { AppDatabase } from "../db/context.js"
import { requireSession, type SessionVariables } from "../middleware.js"
import type { Registry } from "../registry/registry.js"
import { authenticateAgent } from "./oauth.js"

export function connectionRoutes(
  auth: Auth,
  db: AppDatabase,
  registry: Registry,
  authUrl: string,
  webOrigins: string[]
) {
  const routes = new Hono<{ Variables: SessionVariables }>()
  const audience = new URL("/mcp", authUrl).href
  const metadata = new URL("/.well-known/oauth-protected-resource/mcp", authUrl)
    .href
  routes.use("/.well-known/*", async (c, next) => {
    await next()
    c.header("Access-Control-Allow-Origin", "*")
    c.header("Access-Control-Allow-Credentials", undefined)
  })
  const discovery = oauthProviderAuthServerMetadata(auth)
  for (const path of [
    "/.well-known/oauth-authorization-server",
    "/.well-known/oauth-authorization-server/api/auth",
  ]) {
    routes.get(path, (c) => discovery(c.req.raw))
  }
  routes.get("/.well-known/oauth-protected-resource/mcp", (c) =>
    c.json({
      resource: audience,
      authorization_servers: [new URL("/api/auth", authUrl).href],
      scopes_supported: ["connection.status"],
      bearer_methods_supported: ["header"],
    })
  )
  const handler = createMcpHandler(
    () =>
      new McpServer(
        { name: "OpenCV", version: "1.0.0" },
        { capabilities: { tools: {} } }
      )
  )
  routes.all("/mcp", async (c) => {
    const origin = c.req.header("Origin")
    if (
      new URL(c.req.url).host !== new URL(authUrl).host ||
      (origin && !webOrigins.includes(origin))
    )
      return c.json({ error: "invalid_origin" }, 403)
    const connection = await authenticateAgent(
      c.req.header("Authorization"),
      audience
    )
    if (!connection) {
      c.header("WWW-Authenticate", `Bearer resource_metadata="${metadata}"`)
      return c.json({ error: "invalid_token" }, 401)
    }
    const response = await handler.fetch(c.req.raw)
    if (!(await authenticateAgent(c.req.header("Authorization"), audience))) {
      c.header("WWW-Authenticate", `Bearer resource_metadata="${metadata}"`)
      return c.json({ error: "invalid_token" }, 401)
    }
    return response
  })
  routes.get("/api/agent-connections", requireSession(auth, db), async (c) =>
    c.json(
      successEnvelope(
        await registry.read("connections.list", {}, personActor(c.var.userId))
      )
    )
  )
  return routes
}
