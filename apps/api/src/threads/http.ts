import {
  authUnavailableEnvelope,
  ERROR_CODES,
  errorEnvelope,
  httpStatusForError,
  successEnvelope,
  threadIdSchema,
  unauthorizedEnvelope,
} from "@workspace/domain"
import { Hono } from "hono"

import { CommandError, type AppDatabase } from "../commands/registry.js"
import type { Auth } from "../auth.js"
import { jsonWithStatus } from "../http-json.js"
import { readSession } from "../session.js"
import { getThreadDetail, listThreadsForUser } from "./queries.js"

export function createThreadReadRoutes({
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

    const threads = await listThreadsForUser(db, session.user.id)
    return c.json(successEnvelope(threads))
  })

  routes.get("/:id", async (c) => {
    if (!auth || !db) {
      return c.json(authUnavailableEnvelope(), 503)
    }

    const session = await readSession(auth, c)
    if (!session) {
      return c.json(unauthorizedEnvelope(), 401)
    }

    const parsed = threadIdSchema.safeParse(c.req.param("id"))
    if (!parsed.success) {
      return jsonWithStatus(
        c,
        errorEnvelope(ERROR_CODES.VALIDATION_ERROR, "Invalid thread id"),
        httpStatusForError(ERROR_CODES.VALIDATION_ERROR)
      )
    }

    try {
      const thread = await getThreadDetail(db, session.user.id, parsed.data)
      return c.json(successEnvelope(thread))
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
