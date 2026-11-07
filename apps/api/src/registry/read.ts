import {
  ERROR_CODES,
  errorEnvelope,
  personActor,
  successEnvelope,
} from "@workspace/domain"
import { Hono } from "hono"
import type { Auth } from "../auth.js"
import type { AppDatabase } from "../db/context.js"
import { requireSession, type SessionVariables } from "../middleware.js"
import type { Registry } from "./registry.js"

export function createReadRoutes({
  auth,
  db,
  registry,
}: {
  auth?: Auth
  db?: AppDatabase
  registry: Registry
}) {
  const routes = new Hono<{ Variables: SessionVariables }>()
  routes.post("/:name", requireSession(auth, db), async (c) => {
    const name = c.req.param("name")
    if (!registry.catalogRead(name))
      return c.json(
        errorEnvelope(ERROR_CODES.UNKNOWN_COMMAND, "Unknown catalog read"),
        404
      )
    let input: unknown
    try {
      input = await c.req.json()
    } catch {
      return c.json(
        errorEnvelope(
          ERROR_CODES.VALIDATION_ERROR,
          "Request body must be JSON"
        ),
        400
      )
    }
    return c.json(
      successEnvelope(
        await registry.read(name, input, personActor(c.var.userId))
      )
    )
  })
  return routes
}
