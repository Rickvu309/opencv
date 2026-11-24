import {
  authUnavailableEnvelope,
  ERROR_CODES,
  errorEnvelope,
  httpStatusForError,
  unauthorizedEnvelope,
} from "@workspace/domain"
import type { Context, MiddlewareHandler } from "hono"
import { HTTPException } from "hono/http-exception"

import type { Auth } from "./auth.js"
import { withDatabase, type AppDatabase } from "./db/context.js"
import { jsonWithStatus } from "./platform/http-json.js"
import { CommandError } from "./registry/errors.js"
import { readSession } from "./session.js"

type Session = NonNullable<Awaited<ReturnType<typeof readSession>>>

export type SessionVariables = {
  session: Session
  userId: string
  db: AppDatabase
}

export function requireSession(
  auth: Auth | undefined,
  db: AppDatabase | undefined
): MiddlewareHandler<{ Variables: SessionVariables }> {
  return async (c, next) => {
    if (!auth || !db) {
      return jsonWithStatus(
        c,
        authUnavailableEnvelope(),
        httpStatusForError(ERROR_CODES.AUTH_UNAVAILABLE)
      )
    }

    const session = await readSession(auth, c)
    if (!session) {
      return jsonWithStatus(
        c,
        unauthorizedEnvelope(),
        httpStatusForError(ERROR_CODES.UNAUTHORIZED)
      )
    }

    c.set("session", session)
    c.set("userId", session.user.id)
    c.set("db", db)
    return withDatabase(db, () => next())
  }
}

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
