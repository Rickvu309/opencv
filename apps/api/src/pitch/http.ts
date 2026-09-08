import {
  authUnavailableEnvelope,
  errorEnvelope,
  successEnvelope,
  unauthorizedEnvelope,
} from "@workspace/domain"
import { Hono } from "hono"

import type { Auth } from "../auth.js"
import { CommandError, type AppDatabase } from "../commands/registry.js"
import { jsonWithStatus } from "../http-json.js"
import { readSession } from "../session.js"
import { getPitchDocDetail } from "./queries.js"

export function createPitchReadRoutes({
  auth,
  db,
}: {
  auth?: Auth
  db?: AppDatabase
}) {
  const routes = new Hono()

  routes.get("/", async (c) => {
    if (!auth || !db) {
      return c.json(authUnavailableEnvelope(), 503)
    }

    const session = await readSession(auth, c)
    if (!session) {
      return c.json(unauthorizedEnvelope(), 401)
    }

    try {
      const doc = await getPitchDocDetail(db, session.user.id)
      return c.json(successEnvelope(doc))
    } catch (error) {
      if (error instanceof CommandError) {
        return jsonWithStatus(
          c,
          errorEnvelope(error.code, error.message),
          error.status
        )
      }
      throw error
    }
  })

  return routes
}
