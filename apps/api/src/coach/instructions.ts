import type { CoachFocusDoc, CoachSelection } from "@workspace/domain/coach"

import { COACH_STABLE_PROMPT } from "./prompt.js"

export function coachInstructions(context: string) {
  return `${COACH_STABLE_PROMPT}\nContext: ${context}`
}

export function coachTurnContext(input: {
  focusDoc?: CoachFocusDoc | undefined
  selection?: CoachSelection | undefined
  note?: string | undefined
}) {
  const { outline, ...focus } = input.focusDoc ?? {}
  return JSON.stringify({
    document: input.focusDoc ? focus : undefined,
    outline,
    selection: input.selection,
    attachments: input.note,
  })
}
