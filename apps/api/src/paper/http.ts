import {
  authUnavailableEnvelope,
  ERROR_CODES,
  errorEnvelope,
  httpStatusForError,
  paperDocIdSchema,
  successEnvelope,
  unauthorizedEnvelope,
} from "@workspace/domain"
import { Hono } from "hono"

import type { Auth } from "../auth.js"
import { CommandError, type AppDatabase } from "../commands/registry.js"
import { jsonWithStatus } from "../http-json.js"
import { readSession } from "../session.js"
import { getPaperDocDetail, listPaperDocsForUser } from "./queries.js"

export function createPaperReadRoutes({
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

    const docs = await listPaperDocsForUser(db, session.user.id)
    return c.json(successEnvelope(docs))
  })

  routes.get("/:id", async (c) => {
    if (!auth || !db) {
      return c.json(authUnavailableEnvelope(), 503)
    }

    const session = await readSession(auth, c)
    if (!session) {
      return c.json(unauthorizedEnvelope(), 401)
    }

    const parsed = paperDocIdSchema.safeParse(c.req.param("id"))
    if (!parsed.success) {
      return jsonWithStatus(
        c,
        errorEnvelope(ERROR_CODES.VALIDATION_ERROR, "Invalid paper doc id"),
        httpStatusForError(ERROR_CODES.VALIDATION_ERROR)
      )
    }

    try {
      const doc = await getPaperDocDetail(db, session.user.id, parsed.data)
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
