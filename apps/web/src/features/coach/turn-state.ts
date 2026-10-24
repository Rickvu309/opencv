import type { CoachSelection, CoachUsageRating } from "@workspace/domain"

import type { TurnPhase } from "@/features/home/thread-store-context.ts"
import type { HomeMessage } from "@/features/home/threads.ts"

export type TurnKind = "send" | "regenerate"

export type SendError = {
  message: string
  userMessageId: string
  text: string
  local: boolean
  selection?: CoachSelection
}

export type TurnState =
  | { status: "idle"; messages: HomeMessage[] | null }
  | {
      status: "streaming"
      kind: TurnKind
      messages: HomeMessage[]
      waiting: boolean
    }
  | {
      status: "error"
      kind: TurnKind
      messages: HomeMessage[]
      error: SendError
    }
  | { status: "aborted"; messages: HomeMessage[] }

export type TurnAction =
  | { type: "start"; kind: TurnKind; messages: HomeMessage[] }
  | { type: "delta"; messages: HomeMessage[] }
  | { type: "finish"; messages: HomeMessage[] | null }
  | { type: "fail"; error: SendError; messages?: HomeMessage[] }
  | { type: "abort"; messages: HomeMessage[] }
  | { type: "reset" }
  | { type: "rate"; messageId: string; rating: CoachUsageRating }

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
    case "rate":
      if (!state.messages) return state
      return {
        ...state,
        messages: state.messages.map((message) =>
          message.id === action.messageId
            ? { ...message, rating: action.rating }
            : message
        ),
      }
  }
}

export function turnPhase(state: TurnState): TurnPhase {
  if (state.status !== "streaming") return "idle"
  return state.waiting ? "waiting" : "streaming"
}
