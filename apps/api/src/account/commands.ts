import {
  accountDeleteInputSchema,
  accountRequestEmailChangeInputSchema,
  ERROR_CODES,
  notifyRequestInputSchema,
  profileSetPhotoInputSchema,
  profileUpdateInputSchema,
  type Actor,
} from "@workspace/domain"
import { and, eq } from "drizzle-orm"

import { getDb } from "../db/context.js"
import { files, notifyRequests } from "../db/schema.js"
import { createId } from "../id.js"
import { CommandError, isUniqueViolation } from "../registry/errors.js"
import type { Registry } from "../registry/registry.js"
import {
  deleteAccount,
  setProfilePhoto,
  toProfile,
  updateProfile,
} from "./store.js"


export function registerAccount(registry: Registry) {
  registry.addCommand(
    {
      name: "profile.update",
      description: "Update profile, plan mode, and agent settings.",
      input: profileUpdateInputSchema,
      coach: "never",
      destructive: false,
      reversal: () => null,
      step: () => "Update profile",
      activity: () => null,
    },
    (input, actor) => updateProfile(actor, input)
  )

  registry.addCommand(
    {
      name: "profile.setPhoto",
      description: "Set the profile photo from an uploaded file.",
      input: profileSetPhotoInputSchema,
      coach: "never",
      destructive: false,
      reversal: () => null,
      step: () => "Set photo",
      activity: () => null,
    },
    async (input, actor) => {
      const rows = await getDb()
        .select({ id: files.id, purpose: files.purpose })
        .from(files)
        .where(and(eq(files.id, input.fileId), eq(files.userId, actor.userId)))
        .limit(1)
      const file = rows[0]
      if (!file || file.purpose !== "avatar") {
        throw new CommandError(ERROR_CODES.NOT_FOUND, "Photo file not found")
      }
      return setProfilePhoto(actor.userId, file.id)
    }
  )

  registry.addCommand(
    {
      name: "account.requestEmailChange",
      description: "Ask for a code to change the sign-in email.",
      input: accountRequestEmailChangeInputSchema,
      coach: "never",
      destructive: false,
      reversal: () => null,
      step: () => "Request email change",
      activity: () => null,
    },
    async (input) => ({ email: input.email, sent: false })
  )

  registry.addCommand(
    {
      name: "account.delete",
      description: "Delete the account and every row it owns.",
      input: accountDeleteInputSchema,
      coach: "never",
      destructive: true,
      reversal: () => null,
      step: () => "Delete account",
      activity: () => null,
    },
    (input, actor) => deleteOwnedAccount(actor, input.confirm)
  )

  registry.addCommand(
    {
      name: "notify.request",
      description: "Ask to hear when a topic is ready.",
      input: notifyRequestInputSchema,
      coach: "auto",
      destructive: false,
      reversal: () => null,
      step: (input) => `Notify me about ${input.topic}`,
      activity: () => null,
    },
    (input, actor) => requestNotify(actor, input.topic)
  )
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

async function requestNotify(actor: Actor, topic: "jobs" | "proof") {
  const db = getDb()
  const existing = await db
    .select()
    .from(notifyRequests)
    .where(
      and(eq(notifyRequests.userId, actor.userId), eq(notifyRequests.topic, topic))
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
