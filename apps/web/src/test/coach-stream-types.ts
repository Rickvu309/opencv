import type {
  ChatToolName,
  CoachReceiptDetail,
  CoachSelection,
  ReversalDescriptor,
} from "@workspace/domain/coach"
import type { CommandEnvelope } from "@workspace/domain/kernel"

export type CoachScriptPart =
  | { kind: "text"; text: string }
  | {
      kind: "tool"
      name: ChatToolName
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
}

export type CoachStreamControl = {
  release: (count?: number) => void
  releaseAll: () => void
  emitted: () => number
}

export type LastCoachRequest = {
  chatId: string
  text?: string
  mode?: string
  regenerate?: boolean
  focusDocId?: string
  selection?: CoachSelection
  context?: { kind: string; id: string }[]
}

export type GateState = {
  permits: number
  waiters: Array<() => void>
  releasedAll: boolean
  emitted: number
}
