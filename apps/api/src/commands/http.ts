import {
  authUnavailableEnvelope,
  errorEnvelope,
  ERROR_CODES,
  httpStatusForError,
  unauthorizedEnvelope,
} from "@workspace/domain"
import { Hono } from "hono"

import type { Auth } from "../auth.js"
import { jsonWithStatus } from "../http-json.js"
import { readSession } from "../session.js"
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
  const routes = new Hono()

  routes.post("/:name", async (c) => {
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

    const result = await registry.execute({
      name: c.req.param("name"),
      input,
      actor: { type: "user", userId: session.user.id },
      db,
    })

    return jsonWithStatus(c, result.body, result.status)
  })

  return routes
}
