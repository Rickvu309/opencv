import {
  ERROR_CODES,
  errorEnvelope,
  httpStatusForError,
  personActor,
  successEnvelope,
} from "@workspace/domain"
import { Hono } from "hono"

import { jsonWithStatus } from "../platform/http-json.js"
import type { Registry } from "./registry.js"
import type { SignedInGate } from "./signed-in.js"

export const PRIVATE_OUTPUT_KEYS = new Set([
  "previousDocument",
  "previousPatch",
  "previousTitle",
  "previousFocus",
  "previousName",
  "previousTemplateId",
  "previousStarred",
  "previousDone",
  "previousDocId",
  "fromStage",
  "fromPosition",
  "previousStatus",
  "previousSnoozeUntil",
  "previousStage",
  "previousPriority",
  "previousPaper",
])

export function publicCommandOutput(output: unknown) {
  if (!output || typeof output !== "object" || Array.isArray(output))
    return output
  const copy: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(output)) {
    if (!PRIVATE_OUTPUT_KEYS.has(key)) copy[key] = value
  }
  return copy
}

export function withActivityId(
  output: unknown,
  activityId: string | null,
  adopted = false
) {
  const published = adopted ? output : publicCommandOutput(output)
  if (
    !activityId ||
    !published ||
    typeof published !== "object" ||
    Array.isArray(published)
  ) {
    return published
  }
  return { ...published, activityId }
}

export function createCommandRoutes({
  signedIn,
  registry,
}: {
  signedIn: SignedInGate
  registry: Registry
}) {
  const routes = new Hono()

  routes.post("/:name", (c) =>
    signedIn(c, async (userId) => {
      let body: unknown
      try {
        const text = await c.req.text()
        body = text.trim() === "" ? {} : JSON.parse(text)
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

      const wrapped =
        body !== null &&
        typeof body === "object" &&
        !Array.isArray(body) &&
        "input" in body
      const record = wrapped
        ? (body as { input?: unknown; idempotencyKey?: unknown })
        : null
      const input = record ? record.input : body
      const idempotencyKey =
        record && typeof record.idempotencyKey === "string"
          ? record.idempotencyKey
          : undefined
      const name = c.req.param("name")
      const actor = personActor(userId)

      const result = await registry.execute({
        name,
        input,
        actor,
        idempotencyKey,
      })
      if (result.pending) return c.json(successEnvelope(result))
      return c.json({
        ...successEnvelope(
          withActivityId(
            result.output,
            result.activityId,
            registry.isCatalogOperation(name)
          )
        ),
        meta: { touches: result.touches ?? [] },
      })
    })
  )

  return routes
}
