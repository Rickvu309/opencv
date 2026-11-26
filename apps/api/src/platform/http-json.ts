import {
  ERROR_CODES,
  errorEnvelope,
  httpStatusForError,
} from "@workspace/domain/kernel"
import type { Context } from "hono"
import type { ContentfulStatusCode } from "hono/utils/http-status"

export function jsonWithStatus<T>(c: Context, body: T, status: number) {
  return c.json(body, status as ContentfulStatusCode)
}

export async function readJsonBody(c: Context) {
  try {
    const text = await c.req.text()
    return {
      ok: true as const,
      value: text.trim() === "" ? {} : JSON.parse(text),
    }
  } catch {
    return {
      ok: false as const,
      response: jsonWithStatus(
        c,
        errorEnvelope(
          ERROR_CODES.VALIDATION_ERROR,
          "Request body must be JSON"
        ),
        httpStatusForError(ERROR_CODES.VALIDATION_ERROR)
      ),
    }
  }
}
