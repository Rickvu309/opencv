import type { ChatEntryPart, ChatToolName } from "@workspace/domain"

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
      const precedingStep = calls.at(-1)
      const call: CoachProgressCall = {
        kind: "call",
        id: action.id,
        name: action.name,
        label:
          precedingStep?.kind === "step"
            ? precedingStep.label
            : nameLabel(action.name),
      }
      return precedingStep?.kind === "step"
        ? [...calls.slice(0, -1), call]
        : [...calls, call]
    }
  }
}

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
