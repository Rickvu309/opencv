import type { CoachContextItem, CoachSelection } from "@workspace/domain"

import type { TurnPhase } from "@/features/coach/chat-store-context.ts"
import type { ChatViewMessage } from "@/features/coach/chat-messages.ts"

export type TurnKind = "send" | "regenerate"

export type SendError = {
  message: string
  userMessageId: string
  text: string
  local: boolean
  selection?: CoachSelection
  context?: CoachContextItem[]
}

export type TurnState =
  | { status: "idle"; messages: ChatViewMessage[] | null }
  | {
      status: "streaming"
      kind: TurnKind
      messages: ChatViewMessage[]
      waiting: boolean
    }
  | {
      status: "error"
      kind: TurnKind
      messages: ChatViewMessage[]
      error: SendError
    }
  | { status: "aborted"; messages: ChatViewMessage[] }

export type TurnAction =
  | { type: "start"; kind: TurnKind; messages: ChatViewMessage[] }
  | { type: "delta"; messages: ChatViewMessage[] }
  | { type: "finish"; messages: ChatViewMessage[] | null }
  | { type: "fail"; error: SendError; messages?: ChatViewMessage[] }
  | { type: "abort"; messages: ChatViewMessage[] }
  | { type: "reset" }

export const IDLE_TURN: TurnState = { status: "idle", messages: null }

export function turnReducer(state: TurnState, action: TurnAction): TurnState {
  switch (action.type) {
    case "start":
      if (state.status === "streaming") return state
      return {
        status: "streaming",
        kind: action.kind,
        messages: action.messages,
        waiting: true,
      }
    case "delta":
      if (state.status !== "streaming") return state
      return { ...state, messages: action.messages, waiting: false }
    case "finish":
      if (state.status !== "streaming") return state
      return { status: "idle", messages: action.messages }
    case "fail":
      if (state.status !== "streaming") return state
      return {
        status: "error",
        kind: state.kind,
        messages: action.messages ?? state.messages,
        error: action.error,
      }
    case "abort":
      if (state.status !== "streaming") return state
      return { status: "aborted", messages: action.messages }
    case "reset":
      return IDLE_TURN
  }
}

export function turnPhase(state: TurnState): TurnPhase {
  if (state.status !== "streaming") return "idle"
  return state.waiting ? "waiting" : "streaming"
}
