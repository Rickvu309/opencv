import {
  ERROR_CODES,
  errorEnvelope,
  httpStatusForError,
  successEnvelope,
} from "@workspace/domain"
import { Hono } from "hono"

import type { Auth } from "../auth.js"
import type { AppDatabase } from "../db/context.js"
import { readJsonBody } from "../http-json.js"
import { jsonWithStatus } from "../http-json.js"
import { requireSession, type SessionVariables } from "../middleware.js"
import { registry } from "../registry/registry.js"

function person(userId: string) {
  return { type: "person" as const, userId }
}

export function createJobRoutes(auth?: Auth, db?: AppDatabase) {
  const routes = new Hono<{ Variables: SessionVariables }>()
  routes.use("*", requireSession(auth, db))

  routes.get("/", async (c) => {
    const data = await registry.read("job.list", {}, person(c.var.userId))
    return c.json(successEnvelope(data))
  })

  routes.get("/calendar", async (c) => {
    const from = c.req.query("from") ?? ""
    const to = c.req.query("to") ?? ""
    const data = await registry.read(
      "job.calendar",
      { from, to },
      person(c.var.userId)
    )
    return c.json(successEnvelope(data))
  })

  routes.post("/preview", async (c) => {
    const body = await readJsonBody(c)
    if (!body.ok) return body.response
    const data = await registry.read("job.preview", body.value, person(c.var.userId))
    return c.json(successEnvelope(data))
  })

  routes.get("/:id", async (c) => {
    const id = c.req.param("id")
    if (!/^[0-9a-f-]{36}$/i.test(id)) {
      return jsonWithStatus(
        c,
        errorEnvelope(ERROR_CODES.VALIDATION_ERROR, "Invalid job id"),
        httpStatusForError(ERROR_CODES.VALIDATION_ERROR)
      )
    }
    const data = await registry.read("job.get", { jobId: id }, person(c.var.userId))
    return c.json(successEnvelope(data))
  })

  return routes
}
