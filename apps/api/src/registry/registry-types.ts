import type {
  ActivityDraft,
  Actor,
  CoachAccess,
  CommandSpec,
  ReversalPlan,
  ReversalExpect,
  ResourceTouch,
} from "@workspace/domain"
import type { ZodType } from "zod"
import type { StoredReviewedCommand } from "./frozen-review.js"

export type RanCommand = {
  output: unknown
  draft: ActivityDraft | null
  reversal: ReversalPlan
  step: string
}

export type StoredCommand = {
  reviewed?: StoredReviewedCommand
  delegate?: "reversibleJob"
  name: string
  description: string
  coach: CoachAccess
  writes?: CommandSpec<unknown, unknown>["writes"]
  destructive: boolean
  input: ZodType
  step: (input: unknown) => string
  transaction?: "none"
  idempotency: "keyed" | "none"
  run: (input: unknown, actor: Actor) => Promise<RanCommand>
}

export type StoredQuery = {
  delegate?: "jobRead"
  name: string
  description: string
  coach: boolean
  input: ZodType
  step: (input: unknown) => string
  read: (input: unknown, actor: Actor) => Promise<unknown>
}

export type ToolEntry = {
  name: string
  description: string
  kind: "command" | "query"
  coach: CoachAccess | boolean
  destructive: boolean
  step: (input: unknown) => string
  input: ZodType
}

export type ExecuteResult = {
  review?: unknown
  touches?: ResourceTouch[]
  chatId?: string
  pending: boolean
  pendingActionId?: string
  summary?: string
  command?: string
  output?: unknown
  activityId: string | null
  reversal: ReversalPlan
  detail?: unknown
}
export type UndoGuard = (
  userId: string,
  items: readonly { input: unknown; source: string | null }[]
) => Promise<(string | null)[]>

export type ExecuteOptions = {
  name: string
  input: unknown
  actor: Actor
  idempotencyKey?: string
  skipConfirm?: boolean
  skipActivity?: boolean
}
export type TaskOptions = Pick<ExecuteOptions, "name" | "input" | "actor"> & {
  idempotencyKey: string
}
export type UndoCandidate = {
  command: string | null
  input: unknown
  expect?: ReversalExpect | null
  source?: string | null
}
