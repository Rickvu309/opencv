import type {
  CoachReceiptDetail,
  CoachSelection,
  CommandEnvelope,
  ReversalDescriptor,
} from "@workspace/domain"

export type CoachScriptPart =
  | { kind: "text"; text: string }
  | {
      kind: "tool"
      name: string
      summary: string
      ok: boolean
      reversal?: ReversalDescriptor
      result?: CommandEnvelope
      detail?: CoachReceiptDetail
    }

export type CoachStreamScript = {
  gated?: boolean
  delayMs?: number
  texts?: readonly string[]
  parts?: readonly CoachScriptPart[]
  httpError?: { status: number; code: string; message: string }
  networkError?: boolean
  streamError?: string
  omitEnd?: boolean
  workedMs?: number
  undoFail?: { summary: string }
  undoError?: { status: number; code: string; message: string }
  steps?: readonly string[]
  confirm?: {
    pendingActionId: string
    command: string
    summary: string
  }
  result?: {
    activityId: string
    name: string
    summary: string
    changes?: number
    docId?: string
  }
}

export type CoachStreamControl = {
  release: (count?: number) => void
  releaseAll: () => void
  emitted: () => number
}

export type LastCoachRequest = {
  threadId: string
  text?: string
  mode?: string
  regenerate?: boolean
  focusDocId?: string
  selection?: CoachSelection
}

export type GateState = {
  permits: number
  waiters: Array<() => void>
  releasedAll: boolean
  emitted: number
}
