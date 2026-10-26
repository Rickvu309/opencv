import { successEnvelope } from "@workspace/domain"
import { Hono } from "hono"

import type { Auth } from "../auth.js"
import type { AppDatabase } from "../db/context.js"
import { requireSession, type SessionVariables } from "../middleware.js"
import { connectUrl, readInbox, readInboxThread } from "./store.js"

export function createInboxRoutes(
  auth?: Auth,
  db?: AppDatabase,
  gmailEnabled = false
) {
  const routes = new Hono<{ Variables: SessionVariables }>()
  routes.use("*", requireSession(auth, db))

  routes.get("/", async (c) => {
    const data = await readInbox(c.var.userId)
    return c.json(successEnvelope(data))
  })

  routes.get("/connect", (c) =>
    c.json(successEnvelope({ url: gmailEnabled ? connectUrl() : null }))
  )

  routes.get("/callback", (c) => c.json(successEnvelope({ connected: false })))

  routes.get("/:id", async (c) => {
    const data = await readInboxThread(c.var.userId, c.req.param("id"))
    return c.json(successEnvelope(data))
  })

  return routes
}
