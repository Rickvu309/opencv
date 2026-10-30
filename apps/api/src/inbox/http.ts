import { personActor, successEnvelope } from "@workspace/domain"
import { Hono } from "hono"

import type { Auth } from "../auth.js"
import type { AppDatabase } from "../db/context.js"
import { requireSession, type SessionVariables } from "../middleware.js"
import { registry } from "../registry/registry.js"
import { connectUrl } from "./store.js"

export function createInboxRoutes(
  auth?: Auth,
  db?: AppDatabase,
  gmailEnabled = false
) {
  const routes = new Hono<{ Variables: SessionVariables }>()
  routes.use("*", requireSession(auth, db))

  routes.get("/", async (c) => {
    const data = await registry.read(
      "inbox.list",
      {},
      personActor(c.var.userId)
    )
    return c.json(successEnvelope(data))
  })

  routes.get("/snoozed", async (c) => {
    const data = await registry.read(
      "inbox.snoozed",
      {},
      personActor(c.var.userId)
    )
    return c.json(successEnvelope(data))
  })

  routes.get("/connect", (c) =>
    c.json(successEnvelope({ url: gmailEnabled ? connectUrl() : null }))
  )

  routes.get("/callback", (c) => c.json(successEnvelope({ connected: false })))

  routes.get("/:id", async (c) => {
    const data = await registry.read(
      "inbox.get",
      { threadId: c.req.param("id") },
      personActor(c.var.userId)
    )
    return c.json(successEnvelope(data))
  })

  return routes
}
