import { ERROR_CODES, type CoachActor } from "@workspace/domain/kernel"

import type { pendingActions } from "../db/schema.js"
import { CommandError } from "../platform/errors.js"

type Proposal = typeof pendingActions.$inferSelect

export type TaskApproval = {
  actor: CoachActor
  resolve: (
    state: "committed" | "denied" | "expired",
    result: unknown,
    activityId?: string | null
  ) => Promise<void>
}

export type TaskApprovalLock = (
  proposal: Proposal,
  maintenance?: boolean
) => Promise<TaskApproval | null>

export type DelegateProposalChat = {
  open: (input: {
    chatId: string
    userId: string
    connectedAt: Date
  }) => Promise<void>
  show: (
    proposalId: string,
    userId: string,
    read?: ProposalRead
  ) => Promise<void>
}

export type ProposalRead = (name: string, input: unknown) => Promise<unknown>

let taskApprovalLock: TaskApprovalLock | null = null
let delegateProposalChat: DelegateProposalChat | null = null

export function hostTaskApprovals(lock: TaskApprovalLock) {
  taskApprovalLock = lock
}

export function hostDelegateProposals(chat: DelegateProposalChat) {
  delegateProposalChat = chat
}

export function lockTaskApproval(proposal: Proposal, maintenance = false) {
  if (!proposal.coachTaskId) return null
  if (!taskApprovalLock) {
    if (maintenance) return null
    throw new CommandError(
      ERROR_CODES.CONFLICT,
      "This task confirmation requires an active task"
    )
  }
  return taskApprovalLock(proposal, maintenance)
}

export function chatForDelegateProposals() {
  if (!delegateProposalChat)
    throw new CommandError(
      ERROR_CODES.CONFLICT,
      "No Chat is registered to hold a proposal from a connected agent"
    )
  return delegateProposalChat
}
