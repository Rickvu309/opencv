import {
  printJobReducer,
  type PrintJob,
  type PrintJobAction,
} from "./paper-print-job.reducer.ts"

export type LetterState = {
  markdown: string
  updatedAt: string
  hiddenGap: boolean
  conflict: boolean
  printJob: PrintJob
}

export type LetterAction =
  | { type: "letter_typed"; markdown: string }
  | { type: "letter_synced"; markdown: string }
  | { type: "letter_reloaded"; markdown: string; updatedAt: string }
  | { type: "keyword_added"; markdown: string }
  | { type: "keyword_saved"; at: string }
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
    case "keyword_added":
      return { ...state, markdown: action.markdown }
    case "letter_reloaded":
      return {
        ...state,
        markdown: action.markdown,
        updatedAt: action.updatedAt,
        conflict: false,
      }
    case "keyword_saved":
      return { ...state, updatedAt: action.at, hiddenGap: true }
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
