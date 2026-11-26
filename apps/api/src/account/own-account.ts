import { type NotifyTopic } from "@workspace/domain/account"
import { ERROR_CODES, type Actor } from "@workspace/domain/kernel"
import { and, eq } from "drizzle-orm"

import { getDb } from "../db/context.js"
import { notifyRequests } from "../db/schema.js"
import { createId } from "../platform/id.js"
import { CommandError, isUniqueViolation } from "../platform/errors.js"
import {
  sendEmailChangeCode,
  type EmailChangeCodeOutcome,
} from "./email-change-code.js"
import { deleteAccount, toProfile } from "./store.js"

const SEND_FAILED = "We could not send the code. Try again."
const EMAIL_DIFFERENT = "Use a different email."

function authFailure(error: unknown) {
  if (!error || typeof error !== "object") {
    return { message: "", code: undefined as string | undefined }
  }
  const body = "body" in error ? error.body : undefined
  const record =
    body && typeof body === "object"
      ? (body as { message?: unknown; code?: unknown })
      : undefined
  const message =
    typeof record?.message === "string"
      ? record.message
      : error instanceof Error
        ? error.message
        : ""
  const code = typeof record?.code === "string" ? record.code : undefined
  return { message, code }
}

export async function requestEmailChange(email: string) {
  let outcome: EmailChangeCodeOutcome
  try {
    outcome = await sendEmailChangeCode(email)
  } catch (error) {
    const failure = authFailure(error)
    const sameOrInvalid =
      failure.message === "Email is the same" ||
      failure.code === "INVALID_EMAIL" ||
      /invalid email/i.test(failure.message)
    throw new CommandError(
      ERROR_CODES.VALIDATION_ERROR,
      sameOrInvalid ? EMAIL_DIFFERENT : SEND_FAILED
    )
  }
  if (outcome === "outside a request")
    return { email, sent: false, message: SEND_FAILED }
  if (outcome === "refused")
    throw new CommandError(ERROR_CODES.VALIDATION_ERROR, SEND_FAILED)
  return { email, sent: true }
}

export async function deleteOwnedAccount(actor: Actor, confirm: string) {
  if (confirm !== "DELETE") {
    throw new CommandError(
      ERROR_CODES.VALIDATION_ERROR,
      "Type DELETE to confirm account deletion."
    )
  }
  return deleteAccount(actor.userId)
}

export async function requestNotify(actor: Actor, topic: NotifyTopic) {
  const db = getDb()
  const existing = await db
    .select()
    .from(notifyRequests)
    .where(
      and(
        eq(notifyRequests.userId, actor.userId),
        eq(notifyRequests.topic, topic)
      )
    )
    .limit(1)
  if (existing[0]) {
    return {
      id: existing[0].id,
      topic: existing[0].topic,
      createdAt: existing[0].createdAt.toISOString(),
    }
  }
  const id = createId()
  try {
    await db.insert(notifyRequests).values({ id, userId: actor.userId, topic })
  } catch (error) {
    if (!isUniqueViolation(error)) throw error
    const again = await db
      .select()
      .from(notifyRequests)
      .where(
        and(
          eq(notifyRequests.userId, actor.userId),
          eq(notifyRequests.topic, topic)
        )
      )
      .limit(1)
    if (!again[0]) throw error
    return {
      id: again[0].id,
      topic: again[0].topic,
      createdAt: again[0].createdAt.toISOString(),
    }
  }
  return { id, topic, createdAt: new Date().toISOString() }
}

export { toProfile }
