import {
  personActor,
  successEnvelope,
  chatIdSchema,
  ERROR_CODES,
  errorEnvelope,
  httpStatusForError,
} from "@workspace/domain"
import { Hono } from "hono"

import type { Auth } from "../auth.js"
import type { AppDatabase } from "../db/context.js"
import { jsonWithStatus } from "../platform/http-json.js"
import { requireSession, type SessionVariables } from "../middleware.js"
import { registry } from "../registry/registry.js"

export function createChatRoutes(auth?: Auth, db?: AppDatabase) {
  const routes = new Hono<{ Variables: SessionVariables }>()
  routes.use("*", requireSession(auth, db))

  routes.get("/", async (c) => {
    const query = c.req.query("q")
    const data = await registry.read(
      "chat.list",
      query ? { query } : {},
      personActor(c.var.userId)
    )
    return c.json(successEnvelope(data))
  })

  routes.get("/:id", async (c) => {
    const parsed = chatIdSchema.safeParse(c.req.param("id"))
    if (!parsed.success) {
      return jsonWithStatus(
        c,
        errorEnvelope(ERROR_CODES.VALIDATION_ERROR, "Invalid chat id"),
        httpStatusForError(ERROR_CODES.VALIDATION_ERROR)
      )
    }
    const data = await registry.read(
      "chat.get",
      { chatId: parsed.data },
      personActor(c.var.userId)
    )
    return c.json(successEnvelope(data))
  })

  routes.post("/:id/stop", async (c) => {
    const parsed = chatIdSchema.safeParse(c.req.param("id"))
    if (!parsed.success) {
      return jsonWithStatus(
        c,
        errorEnvelope(ERROR_CODES.VALIDATION_ERROR, "Invalid chat id"),
        httpStatusForError(ERROR_CODES.VALIDATION_ERROR)
      )
    }
    const result = await registry.execute({
      name: "coach.stop",
      input: { chatId: parsed.data },
      actor: personActor(c.var.userId),
    })
    return c.json(successEnvelope(result.output))
  })

  return routes
}
