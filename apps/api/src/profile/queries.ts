import {
  ERROR_CODES,
  parseCoachMode,
  type CoachMode,
  type UserProfile,
} from "@workspace/domain"
import { eq } from "drizzle-orm"

import { CommandError, type AppDatabase } from "../commands/registry.js"
import { user } from "../db/schema.js"

function iso(value: Date) {
  return value.toISOString()
}

/** Public profile fields — the same shape GET /api/profile returns. */
export function toProfile(row: {
  id: string
  name: string
  email: string
  emailVerified: boolean
  image: string | null
  coachMode?: CoachMode | null
  createdAt: Date
  updatedAt: Date
}): UserProfile {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    emailVerified: row.emailVerified,
    image: row.image,
    coachMode: parseCoachMode(row.coachMode),
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  }
}

export async function getProfileForUser(
  db: AppDatabase,
  userId: string
): Promise<UserProfile> {
  const [row] = await db
    .select()
    .from(user)
    .where(eq(user.id, userId))
    .limit(1)

  if (!row) {
    throw new CommandError(ERROR_CODES.NOT_FOUND, "Profile not found")
  }

  return toProfile(row)
}

export async function getCoachModeForUser(
  db: AppDatabase,
  userId: string
): Promise<CoachMode> {
  const profile = await getProfileForUser(db, userId)
  return profile.coachMode
}

export async function setCoachModeForUser(
  db: AppDatabase,
  userId: string,
  mode: CoachMode
): Promise<UserProfile> {
  const existing = await getProfileForUser(db, userId)
  const updatedAt = new Date()

  await db
    .update(user)
    .set({ coachMode: mode, updatedAt })
    .where(eq(user.id, userId))

  return {
    ...existing,
    coachMode: mode,
    updatedAt: iso(updatedAt),
  }
}