import { and, count, eq, gte } from "drizzle-orm"
import { ERROR_CODES, type CoachUsageRating } from "@workspace/domain"

import { CommandError, type AppDatabase } from "../commands/registry.js"
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

export type CoachFeedbackResult = {
  messageId: string
  rating: CoachUsageRating
}

export async function rateCoachTurn(
  db: AppDatabase,
  userId: string,
  threadId: string,
  messageId: string,
  rating: CoachUsageRating
): Promise<CoachFeedbackResult> {
  const [row] = await db
    .select({
      id: coachUsage.id,
      threadId: coachUsage.threadId,
    })
    .from(coachUsage)
    .where(
      and(eq(coachUsage.userId, userId), eq(coachUsage.messageId, messageId))
    )
    .limit(1)

  if (!row || row.threadId !== threadId) {
    throw new CommandError(ERROR_CODES.NOT_FOUND, "Coach turn not found")
  }

  await db.update(coachUsage).set({ rating }).where(eq(coachUsage.id, row.id))

  return { messageId, rating }
}
