import {
  ERROR_CODES,
  authUnavailableEnvelope,
  errorEnvelope,
  successEnvelope,
} from "@workspace/domain"
import { Hono } from "hono"

import type { Auth } from "../auth.js"
import type { AppDatabase } from "../commands/registry.js"
import { jsonWithStatus } from "../http-json.js"
import { requireSession, type SessionVariables } from "../middleware.js"
import { getPitchDocDetail, getPublishedPitchBySlug } from "./queries.js"

export function createPitchReadRoutes({
  auth,
  db,
}: {
  auth?: Auth
  db?: AppDatabase
}) {
  const routes = new Hono<{ Variables: SessionVariables }>()

  routes.get("/", requireSession(auth, db), async (c) => {
    const { userId, db } = c.var

    const doc = await getPitchDocDetail(db, userId)
    return c.json(successEnvelope(doc))
  })

  routes.get("/public/:slug", async (c) => {
    if (!db) {
      return c.json(authUnavailableEnvelope(), 503)
    }

    const page = await getPublishedPitchBySlug(db, c.req.param("slug"))
    if (!page) {
      return jsonWithStatus(
        c,
        errorEnvelope(ERROR_CODES.NOT_FOUND, "Pitch not found"),
        404
      )
    }
    return c.json(successEnvelope(page))
  })

  return routes
}
