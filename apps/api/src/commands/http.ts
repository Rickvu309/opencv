import {
  errorEnvelope,
  ERROR_CODES,
  httpStatusForError,
} from "@workspace/domain"
import { Hono } from "hono"

import type { Auth } from "../auth.js"
import { jsonWithStatus } from "../http-json.js"
import { requireSession, type SessionVariables } from "../middleware.js"
import type { AppDatabase, CommandRegistry } from "./registry.js"

export function createCommandRoutes({
  auth,
  db,
  registry,
}: {
  auth?: Auth
  db?: AppDatabase
  registry: CommandRegistry
}) {
  const routes = new Hono<{ Variables: SessionVariables }>()

  routes.post("/:name", requireSession(auth, db), async (c) => {
    const { userId, db } = c.var

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

    const result = await registry.execute({
      name: c.req.param("name"),
      input,
      actor: { type: "user", userId },
      db,
    })

    return jsonWithStatus(c, result.body, result.status)
  })

  return routes
}
