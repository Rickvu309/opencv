import {
  ERROR_CODES,
  errorEnvelope,
  httpStatusForError,
  paperDocIdSchema,
  successEnvelope,
} from "@workspace/domain"
import { Hono } from "hono"

import type { Auth } from "../auth.js"
import type { AppDatabase } from "../commands/registry.js"
import { jsonWithStatus } from "../http-json.js"
import { requireSession, type SessionVariables } from "../middleware.js"
import { getPaperDocDetail, listPaperDocsForUser } from "./queries.js"

export function createPaperReadRoutes({
  auth,
  db,
}: {
  auth?: Auth
  db?: AppDatabase
}) {
  const routes = new Hono<{ Variables: SessionVariables }>()

  routes.get("/", requireSession(auth, db), async (c) => {
    const { userId, db } = c.var

    const docs = await listPaperDocsForUser(db, userId)
    return c.json(successEnvelope(docs))
  })

  routes.get("/:id", requireSession(auth, db), async (c) => {
    const { userId, db } = c.var

    const parsed = paperDocIdSchema.safeParse(c.req.param("id"))
    if (!parsed.success) {
      return jsonWithStatus(
        c,
        errorEnvelope(ERROR_CODES.VALIDATION_ERROR, "Invalid paper doc id"),
        httpStatusForError(ERROR_CODES.VALIDATION_ERROR)
      )
    }

    const doc = await getPaperDocDetail(db, userId, parsed.data)
    return c.json(successEnvelope(doc))
  })

  return routes
}
