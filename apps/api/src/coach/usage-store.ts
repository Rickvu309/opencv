import {
  ERROR_CODES,
  parseChatId,
  parseUserId,
  planAllowsMode,
  type CoachMode,
  type Plan,
} from "@workspace/domain"
import { and, eq, gt, isNull, sql } from "drizzle-orm"

import { getDb, transaction } from "../db/context.js"
import { coachTasks, coachUsage, user } from "../db/schema.js"
import { assertDayCap } from "../account/index.js"
import { insertCoachMessage } from "../chat/index.js"
import { CommandError } from "../registry/errors.js"
import { registry } from "../registry/registry.js"
import { createId } from "../platform/id.js"
import { withMissingReceipts } from "./receipt.js"

export async function saveRepliesForUnsavedTurns(input: {
  userId: string
  chatId: string
}) {
  const unsaved = await getDb()
    .select({
      id: coachUsage.id,
      finishReason: coachUsage.finishReason,
      latencyMs: coachUsage.latencyMs,
    })
    .from(coachUsage)
    .where(
      and(
        eq(coachUsage.chatId, input.chatId),
        eq(coachUsage.userId, input.userId),
        isNull(coachUsage.messageId),
        isNull(coachUsage.coachTaskId)
      )
    )
  const receipts = await registry.turnReceipts(
    input.userId,
    unsaved.map((turn) => turn.id)
  )
  for (const turn of unsaved) {
    const parts = withMissingReceipts(
      [],
      receipts.filter((receipt) => receipt.turnId === turn.id)
    )
    if (parts.length === 0) continue
    const saved = await insertCoachMessage({
      chatId: parseChatId(input.chatId),
      userId: parseUserId(input.userId),
      text: "",
      parts,
      status: "error",
      workedMs: turn.latencyMs ?? 0,
    })
    if (!saved) continue
    await getDb()
      .update(coachUsage)
      .set({
        messageId: saved.id,
        finishReason: turn.finishReason ?? "error",
      })
      .where(eq(coachUsage.id, turn.id))
  }
}

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
    const [task] = await getDb()
      .select({ id: coachTasks.id })
      .from(coachTasks)
      .where(
        and(
          eq(coachTasks.chatId, input.chatId),
          eq(coachTasks.ownerId, input.userId),
          sql`${coachTasks.state} not in ('succeeded','failed','cancelled')`
        )
      )
      .limit(1)
    if (active || task)
      throw new CommandError(
        ERROR_CODES.CONFLICT,
        "Coach is already working in this chat. Stop it or wait for it to finish."
      )
    await saveRepliesForUnsavedTurns(input)
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
