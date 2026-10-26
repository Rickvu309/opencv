import { createFakeMailProvider, successEnvelope } from "@workspace/domain"
import { Hono } from "hono"

import type { Auth } from "../auth.js"
import type { AppDatabase } from "../db/context.js"
import { requireSession, type SessionVariables } from "../middleware.js"

export function createInboxRoutes(
  auth?: Auth,
  db?: AppDatabase,
  gmailEnabled = false
) {
  const routes = new Hono<{ Variables: SessionVariables }>()
  routes.use("*", requireSession(auth, db))
  const mail = createFakeMailProvider()

  routes.get("/", async (c) => {
    if (!gmailEnabled) {
      return c.json(successEnvelope({ connected: false, threads: [] }))
    }
    const threads = await mail.listThreads()
    return c.json(successEnvelope({ connected: true, threads }))
  })

  routes.get("/connect", (c) =>
    c.json(successEnvelope({ connected: false, url: null }))
  )

  routes.get("/callback", (c) => c.json(successEnvelope({ connected: false })))

  routes.get("/:id", async (c) => {
    const detail = await mail.getThread(c.req.param("id"))
    if (!detail)
      return c.json(
        {
          ok: false,
          error: { code: "NOT_FOUND", message: "Thread not found" },
        },
        404
      )
    return c.json(successEnvelope(detail))
  })

  return routes
}
