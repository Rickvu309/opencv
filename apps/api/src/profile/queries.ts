import { ERROR_CODES, type UserProfile } from "@workspace/domain"
import { eq } from "drizzle-orm"

import { CommandError, type AppDatabase } from "../commands/registry.js"
import { user } from "../db/schema.js"

function iso(value: Date) {
  return value.toISOString()
}

/** Public session-user fields — the same shape GET /api/session returns. */
export function toProfile(row: {
  id: string
  name: string
  email: string
  emailVerified: boolean
  image: string | null
  createdAt: Date
  updatedAt: Date
}): UserProfile {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    emailVerified: row.emailVerified,
    image: row.image,
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