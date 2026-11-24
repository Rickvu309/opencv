import {
  authUnavailableEnvelope,
  ERROR_CODES,
  errorEnvelope,
  httpStatusForError,
  unauthorizedEnvelope,
} from "@workspace/domain"
import type { Context } from "hono"
import { HTTPException } from "hono/http-exception"

import { withRequestHeaders, type Auth } from "./auth.js"
import { withDatabase, type AppDatabase } from "./db/context.js"
import { jsonWithStatus } from "./platform/http-json.js"
import type { SignedIn } from "./platform/signed-in.js"
import { CommandError } from "./registry/errors.js"
import { readSession } from "./session.js"

async function sessionOrRefusal(
  auth: Auth | undefined,
  db: AppDatabase | undefined,
  c: Context
) {
  if (!auth || !db) {
    return {
      signedIn: false as const,
      refusal: jsonWithStatus(
        c,
        authUnavailableEnvelope(),
        httpStatusForError(ERROR_CODES.AUTH_UNAVAILABLE)
      ),
    }
  }
  const session = await readSession(auth, c)
  if (!session) {
    return {
      signedIn: false as const,
      refusal: jsonWithStatus(
        c,
        unauthorizedEnvelope(),
        httpStatusForError(ERROR_CODES.UNAUTHORIZED)
      ),
    }
  }
  return { signedIn: true as const, session, auth, db }
}

export function requireSession(
  auth: Auth | undefined,
  db: AppDatabase | undefined
): SignedIn {
  return async (c, next) => {
    const found = await sessionOrRefusal(auth, db, c)
    if (!found.signedIn) return found.refusal
    c.set("userId", found.session.user.id)
    return withRequestHeaders(
      c.req.raw.headers,
      () => withDatabase(found.db, () => next()),
      found.auth
    )
  }
}

export function currentSession(
  auth: Auth | undefined,
  db: AppDatabase | undefined
) {
  return async (c: Context) => {
    const found = await sessionOrRefusal(auth, db, c)
    if (!found.signedIn) return found.refusal
    return c.json({
      ok: true,
      user: found.session.user,
      session: found.session.session,
    })
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
