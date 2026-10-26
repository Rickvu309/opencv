import {
  ERROR_CODES,
  PROFILE_DEFAULTS,
  PLAN_REQUIRED_MESSAGE,
  isKnownTimeZone,
  planAllowsMode,
  type Actor,
  type FileId,
  type ProfileUpdateInput,
  type UserId,
} from "@workspace/domain"
import { eq } from "drizzle-orm"

import { getDb } from "../db/context.js"
import { user } from "../db/schema.js"
import { CommandError } from "../registry/errors.js"

export type ProfileRow = typeof user.$inferSelect

export async function getProfileRow(userId: UserId) {
  const rows = await getDb()
    .select()
    .from(user)
    .where(eq(user.id, userId))
    .limit(1)
  const row = rows[0]
  if (!row) throw new CommandError(ERROR_CODES.NOT_FOUND, "Profile not found")
  return row
}

export function toProfile(row: ProfileRow) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    emailVerified: row.emailVerified,
    image: row.image,
    plan: row.plan,
    coachMode: row.coachMode,
    language: row.language,
    timeZone: row.timeZone,
    startPage: row.startPage,
    notifyEmail: row.notifyEmail,
    notifyBrowser: row.notifyBrowser,
    memoryEnabled: row.memoryEnabled,
    agentChat: row.agentChat,
    agentCvs: row.agentCvs,
    agentInterview: row.agentInterview,
    agentEmail: row.agentEmail,
    agentWeekly: row.agentWeekly,
    welcomedAt: row.welcomedAt?.toISOString() ?? null,
    inboxSkippedAt: row.inboxSkippedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export async function writeProfileDefaults(userId: string) {
  await getDb()
    .update(user)
    .set({
      plan: PROFILE_DEFAULTS.plan,
      coachMode: PROFILE_DEFAULTS.coachMode,
      language: PROFILE_DEFAULTS.language,
      timeZone: PROFILE_DEFAULTS.timeZone,
      startPage: PROFILE_DEFAULTS.startPage,
      notifyEmail: PROFILE_DEFAULTS.notifyEmail,
      notifyBrowser: PROFILE_DEFAULTS.notifyBrowser,
      memoryEnabled: PROFILE_DEFAULTS.memoryEnabled,
      agentChat: PROFILE_DEFAULTS.agentChat,
      agentCvs: PROFILE_DEFAULTS.agentCvs,
      agentInterview: PROFILE_DEFAULTS.agentInterview,
      agentEmail: PROFILE_DEFAULTS.agentEmail,
      agentWeekly: PROFILE_DEFAULTS.agentWeekly,
      updatedAt: new Date(),
    })
    .where(eq(user.id, userId))
}

export async function updateProfile(actor: Actor, input: ProfileUpdateInput) {
  const current = await getProfileRow(actor.userId)
  if (input.coachMode && !planAllowsMode(current.plan, input.coachMode)) {
    throw new CommandError(ERROR_CODES.PLAN_REQUIRED, PLAN_REQUIRED_MESSAGE)
  }
  if (input.timeZone && !isKnownTimeZone(input.timeZone)) {
    throw new CommandError(
      ERROR_CODES.VALIDATION_ERROR,
      "Use a time zone like Asia/Ho_Chi_Minh."
    )
  }
  const updatedAt = new Date()
  await getDb()
    .update(user)
    .set({
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.language !== undefined ? { language: input.language } : {}),
      ...(input.timeZone !== undefined ? { timeZone: input.timeZone } : {}),
      ...(input.startPage !== undefined ? { startPage: input.startPage } : {}),
      ...(input.notifyEmail !== undefined
        ? { notifyEmail: input.notifyEmail }
        : {}),
      ...(input.notifyBrowser !== undefined
        ? { notifyBrowser: input.notifyBrowser }
        : {}),
      ...(input.memoryEnabled !== undefined
        ? { memoryEnabled: input.memoryEnabled }
        : {}),
      ...(input.coachMode !== undefined ? { coachMode: input.coachMode } : {}),
      ...(input.agentChat !== undefined ? { agentChat: input.agentChat } : {}),
      ...(input.agentCvs !== undefined ? { agentCvs: input.agentCvs } : {}),
      ...(input.agentInterview !== undefined
        ? { agentInterview: input.agentInterview }
        : {}),
      ...(input.agentEmail !== undefined
        ? { agentEmail: input.agentEmail }
        : {}),
      ...(input.agentWeekly !== undefined
        ? { agentWeekly: input.agentWeekly }
        : {}),
      updatedAt,
    })
    .where(eq(user.id, actor.userId))
  return toProfile(await getProfileRow(actor.userId))
}

export async function markWelcomed(actor: Actor) {
  const current = await getProfileRow(actor.userId)
  if (!current.welcomedAt) {
    await getDb()
      .update(user)
      .set({ welcomedAt: new Date(), updatedAt: new Date() })
      .where(eq(user.id, actor.userId))
  }
  return toProfile(await getProfileRow(actor.userId))
}

export async function setProfilePhoto(userId: UserId, fileId: FileId) {
  await getDb()
    .update(user)
    .set({ image: fileId, updatedAt: new Date() })
    .where(eq(user.id, userId))
  return toProfile(await getProfileRow(userId))
}

export async function deleteAccount(userId: UserId) {
  await getDb().delete(user).where(eq(user.id, userId))
  return { deleted: true }
}
