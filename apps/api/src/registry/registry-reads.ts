import { and, eq } from "drizzle-orm"

import { getDb } from "../db/context.js"
import { activity, idempotency, user } from "../db/schema.js"
import { GATES_CLOSED_WITHOUT_CONSENT_TO_READ } from "./coach-policy.js"

export async function agentGates(userId: string) {
  const rows = await getDb()
    .select({
      agentCvs: user.agentCvs,
      agentInterview: user.agentInterview,
      agentEmail: user.agentEmail,
    })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1)
  return rows[0] ?? GATES_CLOSED_WITHOUT_CONSENT_TO_READ
}

export async function activityByKey(userId: string, key: string) {
  const rows = await getDb()
    .select()
    .from(activity)
    .where(and(eq(activity.userId, userId), eq(activity.idempotencyKey, key)))
    .limit(1)
  return rows[0] ?? null
}

export async function activityById(userId: string, id: string) {
  const rows = await getDb()
    .select()
    .from(activity)
    .where(and(eq(activity.userId, userId), eq(activity.id, id)))
    .limit(1)
  return rows[0] ?? null
}

export async function idempotencyByKey(userId: string, key: string) {
  const rows = await getDb()
    .select()
    .from(idempotency)
    .where(and(eq(idempotency.userId, userId), eq(idempotency.key, key)))
    .limit(1)
  return rows[0] ?? null
}
