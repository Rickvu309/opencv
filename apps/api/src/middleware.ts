import {
  authUnavailableEnvelope,
  ERROR_CODES,
  httpStatusForError,
  unauthorizedEnvelope,
} from "@workspace/domain"
import type { Context } from "hono"

import { withRequestHeaders, type Auth } from "./auth.js"
import { withDatabase, type AppDatabase } from "./db/context.js"
import { jsonWithStatus } from "./platform/http-json.js"
import type { SignedIn } from "./platform/signed-in.js"
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
