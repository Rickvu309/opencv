import { and, count, eq, gt } from "drizzle-orm"
import type { CoachActor, DelegateActor } from "@workspace/domain"
import {
  createAgentProposalChat,
  appendAgentProposalApproval,
} from "../chat/index.js"
import { getDb, savepoint, transaction } from "../db/context.js"
import { pendingActions, user } from "../db/schema.js"
import { createId } from "../id.js"

export const PENDING_TTL_MS = 24 * 60 * 60 * 1000

export function createProposal(options: {
  actor: CoachActor | DelegateActor
  command: string
  input: unknown
  summary: string
}) {
  return transaction(() => savepoint(() => insertProposal(options)))
}

async function insertProposal(options: {
  actor: CoachActor | DelegateActor
  command: string
  input: unknown
  summary: string
}) {
  const { actor, command, input, summary } = options
  const id = createId()
  const chatId = actor.type === "coach" ? actor.chatId : createId()
  if (actor.type === "delegate") {
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
