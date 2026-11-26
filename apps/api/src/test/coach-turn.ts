import { coachActor, type CoachActor } from "@workspace/domain/kernel"

import { and, eq, isNull, sql } from "drizzle-orm"

import { getDb } from "../db/context.js"
import { activity, coachUsage } from "../db/schema.js"
import { createId } from "../platform/id.js"

export async function seedCoachActor(
  userId: string,
  chatId: string
): Promise<CoachActor> {
  const turnId = createId()
  await getDb().insert(coachUsage).values({
    id: turnId,
    userId,
    chatId,
    plan: "free",
    mode: "free",
    provider: "fake",
    model: "fake",
  })
  return coachActor(userId, chatId, turnId)
}

export async function coachActivityWithoutTurn() {
  return getDb()
    .select({ id: activity.id, command: activity.command })
    .from(activity)
    .where(
      and(
        eq(activity.actor, "coach"),
        isNull(activity.turnId),
        sql`(${activity.idempotencyKey} is null or ${activity.idempotencyKey} not in (select id::text from opencv_app.pending_actions where status = 'approved'))`
      )
    )
}
