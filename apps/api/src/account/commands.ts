import {
  accountContract,
  ERROR_CODES,
  parseFileId,
  type Actor,
} from "@workspace/domain"
import { and, eq } from "drizzle-orm"

import { getBoundAuth, getRequestHeaders } from "../auth.js"
import { getDb } from "../db/context.js"
import { files } from "../db/schema.js"
import { bindCommands } from "../registry/bind.js"
import { CommandError } from "../registry/errors.js"
import type { Registry } from "../registry/registry.js"
import {
  deleteAccount,
  markWelcomed,
  setProfilePhoto,
  toProfile,
  updateProfile,
} from "./store.js"

let commandsAdded = false

export function registerAccount(registry: Registry) {
  if (commandsAdded) return
  commandsAdded = true

  bindCommands(registry, accountContract, {
    "profile.update": {
      handler: (input, actor) => updateProfile(actor, input),
      reversal: () => null,
      activity: () => null,
    },
    "profile.markWelcomed": {
      handler: (_input, actor) => markWelcomed(actor),
      reversal: () => null,
      activity: () => null,
    },
    "profile.setPhoto": {
      handler: async (input, actor) => {
        const rows = await getDb()
          .select({ id: files.id, purpose: files.purpose })
          .from(files)
          .where(
            and(eq(files.id, input.fileId), eq(files.userId, actor.userId))
          )
          .limit(1)
        const file = rows[0]
        if (!file || file.purpose !== "avatar") {
          throw new CommandError(ERROR_CODES.NOT_FOUND, "Photo file not found")
        }
        return setProfilePhoto(actor.userId, parseFileId(file.id))
      },
      reversal: () => null,
      activity: () => null,
    },
    "account.requestEmailChange": {
      handler: (input) => requestEmailChange(input.email),
      reversal: () => null,
      activity: () => null,
      transaction: "none",
    },
    "account.delete": {
      handler: (input, actor) => deleteOwnedAccount(actor, input.confirm),
      reversal: () => null,
      activity: () => null,
    },
  })
}

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

async function requestEmailChange(email: string) {
  const headers = getRequestHeaders()
  if (!headers) {
    return { email, sent: false, message: SEND_FAILED }
  }
  const cookie = headers.get("cookie")
  if (!cookie) {
    throw new CommandError(ERROR_CODES.VALIDATION_ERROR, SEND_FAILED)
  }
  const auth = getBoundAuth()
  if (!auth) {
    throw new CommandError(ERROR_CODES.VALIDATION_ERROR, SEND_FAILED)
  }
  try {
    await auth.api.requestEmailChangeEmailOTP({
      body: { newEmail: email },
      headers,
    })
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
  return { email, sent: true }
}

async function deleteOwnedAccount(actor: Actor, confirm: string) {
  if (confirm !== "DELETE") {
    throw new CommandError(
      ERROR_CODES.VALIDATION_ERROR,
      "Type DELETE to confirm account deletion."
    )
  }
  return deleteAccount(actor.userId)
}

export { toProfile }
