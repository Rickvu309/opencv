import {
  ERROR_CODES,
  planAllowsMode,
  type CoachMode,
  type Plan,
} from "@workspace/domain"
import { and, eq, gt, isNull } from "drizzle-orm"

import { getDb, transaction } from "../db/context.js"
import { coachUsage, user } from "../db/schema.js"
import { assertDayCap } from "../account/index.js"
import { CommandError } from "../registry/errors.js"
import { createId } from "../id.js"

export async function openCoachUsage(input: {
  userId: string
  chatId: string
  plan: Plan
  mode: CoachMode
  provider: string
  model: string
}) {
  return transaction(async () => {
    await getDb()
      .select({ id: user.id })
      .from(user)
      .where(eq(user.id, input.userId))
      .for("update")
    const { profile, plan } = await assertDayCap(input.userId, input.mode)
    if (!profile.agentChat)
      throw new CommandError(
        ERROR_CODES.FORBIDDEN,
        "Coach is turned off in Settings."
      )
    if (!planAllowsMode(plan, input.mode))
      throw new CommandError(
        ERROR_CODES.PLAN_REQUIRED,
        "This Coach mode needs Pro."
      )
    const [active] = await getDb()
      .select({ id: coachUsage.id })
      .from(coachUsage)
      .where(
        and(
          eq(coachUsage.chatId, input.chatId),
          eq(coachUsage.userId, input.userId),
          isNull(coachUsage.finishReason),
          gt(coachUsage.createdAt, new Date(Date.now() - 5 * 60_000))
        )
      )
      .limit(1)
    if (active)
      throw new CommandError(
        ERROR_CODES.CONFLICT,
        "Coach is already working in this chat. Stop it or wait for it to finish."
      )
    const id = createId()
    await getDb().insert(coachUsage).values({
      id,
      userId: input.userId,
      chatId: input.chatId,
      messageId: null,
      plan,
      mode: input.mode,
      provider: input.provider,
      model: input.model,
    })
    return id
  })
}

export async function finishCoachUsage(input: {
  id: string
  messageId: string | null
  finishReason: string
  latencyMs: number
  model?: string
}) {
  await getDb()
    .update(coachUsage)
    .set({
      messageId: input.messageId,
      finishReason: input.finishReason,
      latencyMs: input.latencyMs,
      model: input.model,
    })
    .where(eq(coachUsage.id, input.id))
}
