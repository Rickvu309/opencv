import {
  ERROR_CODES,
  errorEnvelope,
  httpStatusForError,
  personActor,
  successEnvelope,
} from "@workspace/domain"
import { Hono } from "hono"

import { withRequestHeaders, type Auth } from "../auth.js"
import { isCompatCommand, runCompatCommand } from "../compat/index.js"
import type { AppDatabase } from "../db/context.js"
import { jsonWithStatus } from "../http-json.js"
import { requireSession, type SessionVariables } from "../middleware.js"
import { CommandError } from "./errors.js"
import type { Registry } from "./registry.js"

const PRIVATE_OUTPUT_KEYS = new Set([
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

export function withActivityId(output: unknown, activityId: string | null) {
  const published = publicCommandOutput(output)
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
    const actor = personActor(c.var.userId)

    try {
      const data = await withRequestHeaders(
        c.req.raw.headers,
        async () => {
          if (isCompatCommand(name)) {
            return {
              kind: "compat" as const,
              output: await runCompatCommand(registry, name, input, actor),
            }
          }
          return {
            kind: "command" as const,
            result: await registry.execute({
              name,
              input,
              actor,
              idempotencyKey,
            }),
          }
        },
        auth
      )
      if (data.kind === "compat") return c.json(successEnvelope(data.output))
      if (data.result.pending) return c.json(successEnvelope(data.result))
      return c.json(
        successEnvelope(
          withActivityId(data.result.output, data.result.activityId)
        )
      )
    } catch (error) {
      if (error instanceof CommandError) throw error
      throw error
    }
  })

  return routes
}
