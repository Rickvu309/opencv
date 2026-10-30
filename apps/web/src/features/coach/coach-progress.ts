import type { ChatEntryPart, ChatToolName } from "@workspace/domain"

/** One streamed fact: a bare step label, or a tool call joined to its label. */
export type CoachProgressCall =
  | { kind: "step"; id: string; label: string }
  | { kind: "call"; id: string; label: string; name: ChatToolName }

export type CoachProgressStatus =
  "reported" | "running" | "completed" | "failed" | "approval"

export type CoachProgressRow = {
  id: string
  label: string
  status: CoachProgressStatus
}

export type CoachTurnProgress = {
  /** True while a turn is running, so settled turns never show old rows. */
  active: boolean
  rows: readonly CoachProgressRow[]
}

export type CoachProgressAction =
  | { type: "cleared" }
  | { type: "step"; id: string; label: string }
  | { type: "call"; id: string; name: ChatToolName }

function nameLabel(name: string) {
  const words = name.replace(/[._-]+/g, " ")
  return words.charAt(0).toUpperCase() + words.slice(1)
}

export function coachProgressReducer(
  calls: readonly CoachProgressCall[],
  action: CoachProgressAction
): readonly CoachProgressCall[] {
  switch (action.type) {
    case "cleared":
      return []
    case "step":
      return [...calls, { kind: "step", id: action.id, label: action.label }]
    case "call": {
      if (calls.some((call) => call.id === action.id)) return calls
      // The server emits a call's step label right before the call itself.
      const previous = calls.at(-1)
      const call: CoachProgressCall = {
        kind: "call",
        id: action.id,
        name: action.name,
        label:
          previous?.kind === "step" ? previous.label : nameLabel(action.name),
      }
      return previous?.kind === "step"
        ? [...calls.slice(0, -1), call]
        : [...calls, call]
    }
  }
}

/** Status comes only from the call's own result part, never from what arrived after it. */
export function coachProgressRows(
  calls: readonly CoachProgressCall[],
  parts: readonly ChatEntryPart[]
): CoachProgressRow[] {
  return calls.map((call): CoachProgressRow => {
    if (call.kind === "step")
      return { id: call.id, label: call.label, status: "reported" }
    const result = parts.find(
      (part) => part.type === "tool" && part.toolCallId === call.id
    )
    const status: CoachProgressStatus =
      result?.type !== "tool"
        ? "running"
        : result.approval === "pending" || result.pendingActionId
          ? "approval"
          : !result.ok ||
              result.approval === "denied" ||
              result.approval === "expired"
            ? "failed"
            : "completed"
    return { id: call.id, label: call.label, status }
  })
}
