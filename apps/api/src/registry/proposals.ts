import { and, count, eq, gt, sql } from "drizzle-orm"
import {
  ERROR_CODES,
  type CoachActor,
  type DelegateActor,
} from "@workspace/domain"
import {
  createAgentProposalChat,
  appendAgentProposalApproval,
} from "../chat/index.js"
import { getDb, savepoint, transaction } from "../db/context.js"
import { activity, idempotency, pendingActions, user } from "../db/schema.js"
import { createId } from "../id.js"

import { requireLiveDelegate } from "./delegate-policy.js"
import { CommandError } from "./errors.js"
import { inputHash } from "./receipt.js"

export const PENDING_TTL_MS = 24 * 60 * 60 * 1000

export function createProposal(options: {
  actor: CoachActor | DelegateActor
  command: string
  input: unknown
  summary: string
  basisRevision: number | null
}) {
  return transaction(() => savepoint(() => insertProposal(options)))
}

async function insertProposal(options: {
  actor: CoachActor | DelegateActor
  command: string
  input: unknown
  summary: string
  basisRevision: number | null
}) {
  const { actor, command, input, summary, basisRevision } = options
  const id = createId()
  const chatId = actor.type === "coach" ? actor.chatId : createId()
  if (actor.type === "delegate") {
    await requireLiveDelegate(actor)
    await getDb()
      .select({ id: user.id })
      .from(user)
      .where(eq(user.id, actor.userId))
      .for("update")
    const [outstanding] = await getDb()
      .select({ count: count() })
      .from(pendingActions)
      .where(
        and(
          eq(pendingActions.delegateConnectionId, actor.connectionId),
          eq(pendingActions.status, "pending"),
          gt(pendingActions.createdAt, new Date(Date.now() - PENDING_TTL_MS))
        )
      )
    if ((outstanding?.count ?? 0) >= 20)
      throw new Error(
        "This connection has 20 pending proposals. Approve or deny existing proposals in OpenCV before proposing more."
      )
    await createAgentProposalChat({
      chatId,
      userId: actor.userId,
      name: actor.name,
    })
  }
  await getDb()
    .insert(pendingActions)
    .values({
      id,
      userId: actor.userId,
      chatId,
      delegateConnectionId:
        actor.type === "delegate" ? actor.connectionId : null,
      turnId: actor.type === "coach" ? (actor.turnId ?? null) : null,
      command,
      input,
      summary,
      basisRevision,
      status: "pending",
    })
  if (actor.type === "delegate")
    await appendAgentProposalApproval(id, actor.userId)
  return {
    pending: true as const,
    pendingActionId: id,
    chatId,
    summary,
    command,
    activityId: null,
    reversal: null,
  }
}

export async function expireIfStale(userId: string, id: string) {
  const rows = await getDb()
    .select()
    .from(pendingActions)
    .where(and(eq(pendingActions.id, id), eq(pendingActions.userId, userId)))
    .limit(1)
  const row = rows[0]
  if (!row || row.status !== "pending" || row.coachTaskId) return
  if (Date.now() - row.createdAt.getTime() <= PENDING_TTL_MS) return
  await getDb()
    .update(pendingActions)
    .set({ status: "expired" })
    .where(eq(pendingActions.id, row.id))
  throw new CommandError(
    ERROR_CODES.PENDING_EXPIRED,
    "This confirmation expired. Ask the Coach again."
  )
}

export async function lockProposal(userId: string, id: string) {
  const [proposal] = await getDb()
    .select()
    .from(pendingActions)
    .where(and(eq(pendingActions.id, id), eq(pendingActions.userId, userId)))
  const task = proposal?.coachTaskId
    ? await (await import("../coach/index.js")).lockTaskApproval(proposal)
    : null
  const row = await lockPending(userId, id)
  const [expired] = await getDb()
    .select({ id: pendingActions.id })
    .from(pendingActions)
    .where(
      and(
        eq(pendingActions.id, id),
        sql`${pendingActions.createdAt} + interval '24 hours' <= clock_timestamp()`
      )
    )
  if (task && expired && row.status === "pending")
    throw new CommandError(
      ERROR_CODES.PENDING_EXPIRED,
      "This confirmation expired. Ask the Coach again."
    )
  return { row, task }
}

export async function expireTaskApprovals() {
  const rows = await getDb()
    .select()
    .from(pendingActions)
    .where(
      sql`${pendingActions.coachTaskId} is not null and ${pendingActions.status} = 'pending' and ${pendingActions.createdAt} + interval '24 hours' <= clock_timestamp()`
    )
  for (const proposal of rows)
    await transaction(async () => {
      const { lockTaskApproval, resolveTaskApproval } =
        await import("../coach/index.js")
      const task = await lockTaskApproval(proposal, true)
      if (!task) return
      const row = await lockPending(proposal.userId, proposal.id)
      if (!task || row.status !== "pending") return
      await getDb()
        .update(pendingActions)
        .set({ status: "expired" })
        .where(eq(pendingActions.id, row.id))
      await resolveTaskApproval(task, "expired", { expired: true })
    })
}

export async function lockPending(userId: string, id: string) {
  const rows = await getDb()
    .select()
    .from(pendingActions)
    .where(and(eq(pendingActions.id, id), eq(pendingActions.userId, userId)))
    .for("update")
  const row = rows[0]
  if (!row) {
    throw new CommandError(
      ERROR_CODES.NOT_FOUND,
      "That confirmation was not found"
    )
  }
  return row
}

export async function assertTaskReceipt(
  userId: string,
  row: typeof pendingActions.$inferSelect
) {
  const [edit] = await getDb()
    .select()
    .from(activity)
    .where(
      and(
        eq(activity.userId, userId),
        eq(activity.idempotencyKey, row.coachIntentKey!)
      )
    )
    .limit(1)
  const [stored] = await getDb()
    .select()
    .from(idempotency)
    .where(
      and(
        eq(idempotency.userId, userId),
        eq(idempotency.key, row.coachIntentKey!)
      )
    )
    .limit(1)
  const receipts = [edit, stored].filter(
    (receipt) => receipt !== null && receipt !== undefined
  )
  if (
    receipts.length !== 1 ||
    receipts.some(
      (receipt) =>
        receipt.command !== row.command ||
        receipt.inputHash !== inputHash(row.input)
    )
  )
    throw new CommandError(
      ERROR_CODES.CONFLICT,
      "Task receipt does not match its intent"
    )
}
