import type { LetterDocument } from "@workspace/domain"

import {
  printJobReducer,
  type PrintJob,
  type PrintJobAction,
} from "./paper-print-job.reducer.ts"

export type LetterState = {
  letter: LetterDocument
  updatedAt: string
  hiddenGap: boolean
  conflict: boolean
  printJob: PrintJob
}

export type LetterAction =
  | { type: "letter_typed"; letter: LetterDocument }
  | { type: "letter_synced"; letter: LetterDocument }
  | { type: "letter_reloaded"; letter: LetterDocument; updatedAt: string }
  | { type: "keyword_added"; letter: LetterDocument }
  | { type: "gap_dismissed" }
  | { type: "saved"; at: string }
  | { type: "conflict_detected" }
  | PrintJobAction

export function letterReducer(
  state: LetterState,
  action: LetterAction
): LetterState {
  switch (action.type) {
    case "letter_typed":
    case "letter_synced":
      return { ...state, letter: action.letter }
    case "keyword_added":
      return { ...state, letter: action.letter, hiddenGap: true }
    case "letter_reloaded":
      return {
        ...state,
        letter: action.letter,
        updatedAt: action.updatedAt,
        conflict: false,
      }
    case "gap_dismissed":
      return { ...state, hiddenGap: true }
    case "saved":
      return { ...state, updatedAt: action.at, conflict: false }
    case "conflict_detected":
      return { ...state, conflict: true }
    case "print_requested":
    case "print_finished":
      return { ...state, printJob: printJobReducer(state.printJob, action) }
  }
}
