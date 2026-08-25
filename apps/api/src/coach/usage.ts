import { and, count, eq, gte } from "drizzle-orm"

import type { AppDatabase } from "../commands/registry.js"
import { coachUsage } from "../db/schema.js"

export function startOfUtcDay(now = new Date()): Date {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  )
}

export async function countCoachTurnsSince(
  db: AppDatabase,
  userId: string,
  since: Date
): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(coachUsage)
    .where(and(eq(coachUsage.userId, userId), gte(coachUsage.createdAt, since)))

  return row?.value ?? 0
}

export async function countCoachTurnsToday(
  db: AppDatabase,
  userId: string,
  now = new Date()
): Promise<number> {
  return countCoachTurnsSince(db, userId, startOfUtcDay(now))
}
