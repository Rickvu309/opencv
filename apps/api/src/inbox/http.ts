import { personActor, successEnvelope } from "@workspace/domain"
import { Hono } from "hono"

import type { SignedIn, SignedInVariables } from "../platform/signed-in.js"
import { registry } from "../registry/registry.js"
import { connectUrl } from "./store.js"

export function createInboxRoutes(signedIn: SignedIn, gmailEnabled = false) {
  const routes = new Hono<{ Variables: SignedInVariables }>()
  routes.use("*", signedIn)

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
