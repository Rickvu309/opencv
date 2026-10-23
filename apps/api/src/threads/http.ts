import {
  ERROR_CODES,
  errorEnvelope,
  httpStatusForError,
  paperDocIdSchema,
  successEnvelope,
  threadIdSchema,
} from "@workspace/domain"
import { Hono } from "hono"

import type { AppDatabase } from "../commands/registry.js"
import type { Auth } from "../auth.js"
import { jsonWithStatus } from "../http-json.js"
import { requireSession, type SessionVariables } from "../middleware.js"
import {
  getLatestThreadForFocusDoc,
  getThreadDetail,
  listThreadsForUser,
} from "./queries.js"

export function createThreadReadRoutes({
  auth,
  db,
}: {
  auth?: Auth
  db?: AppDatabase
}) {
  const routes = new Hono<{ Variables: SessionVariables }>()

  routes.get("/", requireSession(auth, db), async (c) => {
    const { userId, db } = c.var

    const focusDocIdRaw = c.req.query("focusDocId")
    if (focusDocIdRaw !== undefined) {
      const parsed = paperDocIdSchema.safeParse(focusDocIdRaw)
      if (!parsed.success) {
        return jsonWithStatus(
          c,
          errorEnvelope(ERROR_CODES.VALIDATION_ERROR, "Invalid focusDocId"),
          httpStatusForError(ERROR_CODES.VALIDATION_ERROR)
        )
      }

      const thread = await getLatestThreadForFocusDoc(db, userId, parsed.data)
      return c.json(successEnvelope(thread))
    }

    const threads = await listThreadsForUser(db, userId)
    return c.json(successEnvelope(threads))
  })

  routes.get("/:id", requireSession(auth, db), async (c) => {
    const { userId, db } = c.var

    const parsed = threadIdSchema.safeParse(c.req.param("id"))
    if (!parsed.success) {
      return jsonWithStatus(
        c,
        errorEnvelope(ERROR_CODES.VALIDATION_ERROR, "Invalid thread id"),
        httpStatusForError(ERROR_CODES.VALIDATION_ERROR)
      )
    }

    const thread = await getThreadDetail(db, userId, parsed.data)
    return c.json(successEnvelope(thread))
  })

  return routes
}
