import type {
  ActivityDraft,
  Actor,
  CoachAccess,
  CommandSpec,
  DelegateMarker,
  ReversalPlan,
  ReversalExpect,
  ResourceTouch,
} from "@workspace/domain/kernel"
import type { ZodType } from "zod"

export type ProposalBasis<I> = (
  input: I,
  actor: Actor
) => Promise<number | null>

export type RanCommand = {
  output: unknown
  draft: ActivityDraft | null
  reversal: ReversalPlan
  step: string
}

export type StoredCommand = {
  undoOnly?: boolean
  delegate?: DelegateMarker
  name: string
  description: string
  coach: CoachAccess
  writes?: CommandSpec<unknown, unknown>["writes"]
  destructive: boolean
  input: ZodType
  step: (input: unknown) => string
  transaction?: "none"
  idempotency: "keyed" | "none"
  prepare?: (input: unknown, actor: Actor) => Promise<unknown>
  basis?: ProposalBasis<unknown>
  run: (input: unknown, actor: Actor, prepared?: unknown) => Promise<RanCommand>
}

export type StoredQuery = {
  delegate?: DelegateMarker
  name: string
  description: string
  coach: boolean
  input: ZodType
  step: (input: unknown) => string
  read: (input: unknown, actor: Actor) => Promise<unknown>
  visitor?: (input: unknown) => Promise<unknown>
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
