import type { CoachMode, Plan } from "@workspace/domain"
import { eq } from "drizzle-orm"

import { getDb } from "../db/context.js"
import { coachUsage } from "../db/schema.js"
import { createId } from "../id.js"

export async function openCoachUsage(input: {
  userId: string
  chatId: string
  plan: Plan
  mode: CoachMode
  provider: string
  model: string
}) {
  const id = createId()
  await getDb().insert(coachUsage).values({
    id,
    userId: input.userId,
    chatId: input.chatId,
    messageId: null,
    plan: input.plan,
    mode: input.mode,
    provider: input.provider,
    model: input.model,
  })
  return id
}

export async function finishCoachUsage(input: {
  id: string
  messageId: string | null
  finishReason: string
  latencyMs: number
}) {
  await getDb()
    .update(coachUsage)
    .set({
      messageId: input.messageId,
      finishReason: input.finishReason,
      latencyMs: input.latencyMs,
    })
    .where(eq(coachUsage.id, input.id))
}
