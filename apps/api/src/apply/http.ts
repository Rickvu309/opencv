import {
  applyCardIdSchema,
  authUnavailableEnvelope,
  ERROR_CODES,
  errorEnvelope,
  httpStatusForError,
  successEnvelope,
  unauthorizedEnvelope,
  type CoachRuntime,
} from "@workspace/domain"
import { Hono } from "hono"

import type { Auth } from "../auth.js"
import { CommandError, type AppDatabase } from "../commands/registry.js"
import { jsonWithStatus } from "../http-json.js"
import { readSession } from "../session.js"
import { fetchJobPosting, type FetchJobPosting } from "./fetch-posting.js"
import { getApplyCardDetail, listApplyCardsForUser } from "./queries.js"
import { scanApplyPosting } from "./scan.js"

export function createApplyReadRoutes({
  auth,
  db,
  coach,
  fetchJobPosting: fetchPosting = fetchJobPosting,
}: {
  auth?: Auth
  db?: AppDatabase
  coach?: CoachRuntime
  fetchJobPosting?: FetchJobPosting
}) {
  const routes = new Hono()

  routes.post("/scan", async (c) => {
    if (!auth || !db) {
      return c.json(authUnavailableEnvelope(), 503)
    }

    const session = await readSession(auth, c)
    if (!session) {
      return c.json(unauthorizedEnvelope(), 401)
    }

    let input: unknown
    try {
      const text = await c.req.text()
      input = text.trim() === "" ? {} : JSON.parse(text)
    } catch {
      return jsonWithStatus(
        c,
        errorEnvelope(
          ERROR_CODES.VALIDATION_ERROR,
          "Request body must be JSON"
        ),
        httpStatusForError(ERROR_CODES.VALIDATION_ERROR)
      )
    }

    const result = await scanApplyPosting({
      input,
      coach,
      fetchJobPosting: fetchPosting,
    })
    if (!result.ok) {
      return jsonWithStatus(
        c,
        errorEnvelope(result.code, result.message),
        httpStatusForError(result.code)
      )
    }
    return c.json(successEnvelope(result.data))
  })

  routes.get("/", async (c) => {
    if (!auth || !db) {
      return c.json(authUnavailableEnvelope(), 503)
    }

    const session = await readSession(auth, c)
    if (!session) {
      return c.json(unauthorizedEnvelope(), 401)
    }

    const cards = await listApplyCardsForUser(db, session.user.id)
    return c.json(successEnvelope(cards))
  })

  routes.get("/:id", async (c) => {
    if (!auth || !db) {
      return c.json(authUnavailableEnvelope(), 503)
    }

    const session = await readSession(auth, c)
    if (!session) {
      return c.json(unauthorizedEnvelope(), 401)
    }

    const parsed = applyCardIdSchema.safeParse(c.req.param("id"))
    if (!parsed.success) {
      return jsonWithStatus(
        c,
        errorEnvelope(ERROR_CODES.VALIDATION_ERROR, "Invalid apply card id"),
        httpStatusForError(ERROR_CODES.VALIDATION_ERROR)
      )
    }

    try {
      const card = await getApplyCardDetail(db, session.user.id, parsed.data)
      return c.json(successEnvelope(card))
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
