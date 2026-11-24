import {
  authUnavailableEnvelope,
  ERROR_CODES,
  errorEnvelope,
  httpStatusForError,
  unauthorizedEnvelope,
} from "@workspace/domain"
import type { Context, MiddlewareHandler } from "hono"
import { HTTPException } from "hono/http-exception"

import { withRequestHeaders, type Auth } from "./auth.js"
import { withDatabase, type AppDatabase } from "./db/context.js"
import { jsonWithStatus } from "./platform/http-json.js"
import { CommandError } from "./registry/errors.js"
import type { SignedInGate } from "./registry/signed-in.js"
import { readSession } from "./session.js"

type Session = NonNullable<Awaited<ReturnType<typeof readSession>>>

export type SessionVariables = {
  session: Session
  userId: string
  db: AppDatabase
}

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
): MiddlewareHandler<{ Variables: SessionVariables }> {
  return async (c, next) => {
    const found = await sessionOrRefusal(auth, db, c)
    if (!found.signedIn) return found.refusal
    c.set("session", found.session)
    c.set("userId", found.session.user.id)
    c.set("db", found.db)
    return withDatabase(found.db, () => next())
  }
}

export function signedInGate(
  auth: Auth | undefined,
  db: AppDatabase | undefined
): SignedInGate {
  return async (c, run) => {
    const found = await sessionOrRefusal(auth, db, c)
    if (!found.signedIn) return found.refusal
    return withRequestHeaders(
      c.req.raw.headers,
      () => withDatabase(found.db, () => run(found.session.user.id)),
      found.auth
    )
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
