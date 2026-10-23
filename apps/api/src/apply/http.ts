import {
  applyCardIdSchema,
  ERROR_CODES,
  errorEnvelope,
  httpStatusForError,
  successEnvelope,
  type CoachRuntime,
} from "@workspace/domain"
import { Hono } from "hono"

import type { Auth } from "../auth.js"
import type { AppDatabase } from "../commands/registry.js"
import { jsonWithStatus } from "../http-json.js"
import { requireSession, type SessionVariables } from "../middleware.js"
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
  const routes = new Hono<{ Variables: SessionVariables }>()

  routes.post("/scan", requireSession(auth, db), async (c) => {
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

  routes.get("/", requireSession(auth, db), async (c) => {
    const { userId, db } = c.var

    const cards = await listApplyCardsForUser(db, userId)
    return c.json(successEnvelope(cards))
  })

  routes.get("/:id", requireSession(auth, db), async (c) => {
    const { userId, db } = c.var

    const parsed = applyCardIdSchema.safeParse(c.req.param("id"))
    if (!parsed.success) {
      return jsonWithStatus(
        c,
        errorEnvelope(ERROR_CODES.VALIDATION_ERROR, "Invalid apply card id"),
        httpStatusForError(ERROR_CODES.VALIDATION_ERROR)
      )
    }

    const card = await getApplyCardDetail(db, userId, parsed.data)
    return c.json(successEnvelope(card))
  })

  return routes
}
