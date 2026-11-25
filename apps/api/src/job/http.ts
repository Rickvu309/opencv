import {
  catalog,
  ERROR_CODES,
  errorEnvelope,
  httpStatusForError,
  personActor,
  successEnvelope,
} from "@workspace/domain"
import { Hono } from "hono"

import { jsonWithStatus } from "../platform/http-json.js"
import type { SignedIn, SignedInVariables } from "../platform/signed-in.js"
import { registry } from "../registry/registry.js"

export function createJobRoutes(signedIn: SignedIn) {
  const routes = new Hono<{ Variables: SignedInVariables }>()
  routes.use("*", signedIn)

  routes.get("/", async (c) =>
    c.json(
      successEnvelope(
        await registry.read(
          catalog["job.list"].name,
          {},
          personActor(c.var.userId)
        )
      )
    )
  )

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
        await registry.read(
          catalog["job.get"].name,
          { jobId },
          personActor(c.var.userId)
        )
      )
    )
  })

  return routes
}
