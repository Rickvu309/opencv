import {
  ERROR_CODES,
  errorEnvelope,
  personActor,
  successEnvelope,
} from "@workspace/domain"
import { Hono } from "hono"
import type { Registry } from "./registry.js"
import type { SignedInGate } from "./signed-in.js"

export function createReadRoutes({
  signedIn,
  registry,
}: {
  signedIn: SignedInGate
  registry: Registry
}) {
  const routes = new Hono()
  routes.post("/:name", (c) =>
    signedIn(c, async (userId) => {
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
        successEnvelope(await registry.read(name, input, personActor(userId)))
      )
    })
  )
  return routes
}
