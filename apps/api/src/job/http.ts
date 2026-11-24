import {
  ERROR_CODES,
  errorEnvelope,
  httpStatusForError,
  personActor,
  successEnvelope,
} from "@workspace/domain"
import { Hono } from "hono"

import { jsonWithStatus, readJsonBody } from "../platform/http-json.js"
import type { SignedIn, SignedInVariables } from "../platform/signed-in.js"
import { registry } from "../registry/registry.js"

export function createJobRoutes(signedIn: SignedIn) {
  const routes = new Hono<{ Variables: SignedInVariables }>()
  routes.use("*", signedIn)

  routes.get("/", async (c) =>
    c.json(
      successEnvelope(
        await registry.read("job.list", {}, personActor(c.var.userId))
      )
    )
  )

  routes.get("/calendar", async (c) =>
    c.json(
      successEnvelope(
        await registry.read(
          "job.calendar",
          { from: c.req.query("from") ?? "", to: c.req.query("to") ?? "" },
          personActor(c.var.userId)
        )
      )
    )
  )

  routes.post("/preview", async (c) => {
    const body = await readJsonBody(c)
    if (!body.ok) return body.response
    return c.json(
      successEnvelope(
        await registry.read(
          "job.preview",
          body.value,
          personActor(c.var.userId)
        )
      )
    )
  })

  routes.get("/:id", async (c) => {
    const jobId = c.req.param("id")
    if (!/^[0-9a-f-]{36}$/i.test(jobId))
      return jsonWithStatus(
        c,
        errorEnvelope(ERROR_CODES.VALIDATION_ERROR, "Invalid job id"),
        httpStatusForError(ERROR_CODES.VALIDATION_ERROR)
      )
    return c.json(
      successEnvelope(
        await registry.read("job.get", { jobId }, personActor(c.var.userId))
      )
    )
  })

  return routes
}
