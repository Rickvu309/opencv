import {
  personActor,
  successEnvelope,
  chatIdSchema,
  ERROR_CODES,
  errorEnvelope,
  httpStatusForError,
} from "@workspace/domain"
import { Hono } from "hono"

import { jsonWithStatus } from "../../platform/http-json.js"
import type { SignedIn, SignedInVariables } from "../../platform/signed-in.js"
import { registry } from "../../registry/registry.js"

export function createChatRoutes(signedIn: SignedIn) {
  const routes = new Hono<{ Variables: SignedInVariables }>()
  routes.use("*", signedIn)

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

  return routes
}
