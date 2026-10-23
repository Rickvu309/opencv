import { successEnvelope } from "@workspace/domain"
import { Hono } from "hono"

import type { Auth } from "../auth.js"
import type { AppDatabase } from "../commands/registry.js"
import { requireSession, type SessionVariables } from "../middleware.js"
import { getProfileForUser } from "./queries.js"

export function createProfileReadRoutes({
  auth,
  db,
}: {
  auth?: Auth
  db?: AppDatabase
}) {
  const routes = new Hono<{ Variables: SessionVariables }>()

  routes.get("/", requireSession(auth, db), async (c) => {
    const { userId, db } = c.var

    const profile = await getProfileForUser(db, userId)
    return c.json(successEnvelope(profile))
  })

  return routes
}
