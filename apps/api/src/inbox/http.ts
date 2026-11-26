import { successEnvelope } from "@workspace/domain/kernel"
import { Hono } from "hono"

import type { SignedIn, SignedInVariables } from "../platform/signed-in.js"
import { connectUrl } from "./store.js"

export function createInboxRoutes(signedIn: SignedIn, gmailEnabled = false) {
  const routes = new Hono<{ Variables: SignedInVariables }>()
  routes.use("*", signedIn)

  routes.get("/connect", (c) =>
    c.json(successEnvelope({ url: gmailEnabled ? connectUrl() : null }))
  )

  routes.get("/callback", (c) => c.json(successEnvelope({ connected: false })))

  return routes
}
