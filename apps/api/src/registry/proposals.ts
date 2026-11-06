import type { CoachActor, DelegateActor } from "@workspace/domain"
import { createAgentProposalChat } from "../chat/index.js"
import { getDb } from "../db/context.js"
import { pendingActions } from "../db/schema.js"
import { createId } from "../id.js"

export async function createProposal(options: {
  actor: CoachActor | DelegateActor
  command: string
  input: unknown
  summary: string
}) {
  const { actor, command, input, summary } = options
  const id = createId()
  const chatId = actor.type === "coach" ? actor.chatId : createId()
  if (actor.type === "delegate") {
    await createAgentProposalChat({
      chatId,
      userId: actor.userId,
      name: actor.name,
      command,
      summary,
      pendingActionId: id,
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
