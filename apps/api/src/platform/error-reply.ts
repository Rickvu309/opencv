import {
  ERROR_CODES,
  errorEnvelope,
  httpStatusForError,
} from "@workspace/domain/kernel"
import type { Context } from "hono"
import { HTTPException } from "hono/http-exception"

import { CommandError } from "./errors.js"
import { jsonWithStatus } from "./http-json.js"

export function handleApiError(error: Error, c: Context) {
  if (error instanceof HTTPException && error.status === 413) {
    return jsonWithStatus(
      c,
      errorEnvelope(ERROR_CODES.VALIDATION_ERROR, "Request body is too large"),
      413
    )
  }

  if (error instanceof CommandError) {
    return jsonWithStatus(
      c,
      {
        ok: false,
        error: { code: error.code, message: error.message, ...error.detail },
      },
      error.status
    )
  }

  console.error(error)
  return jsonWithStatus(
    c,
    errorEnvelope(ERROR_CODES.INTERNAL_ERROR, "Something went wrong"),
    httpStatusForError(ERROR_CODES.INTERNAL_ERROR)
  )
}

export function notFoundEnvelopeResponse(c: Context) {
  return jsonWithStatus(
    c,
    errorEnvelope(ERROR_CODES.NOT_FOUND, "Not found"),
    httpStatusForError(ERROR_CODES.NOT_FOUND)
  )
}
