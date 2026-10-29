import type { JobView } from "@workspace/domain"

import type { PaperLimitError } from "./paper-api.ts"

export type LetterStartState = {
  jobs: JobView[]
  query: string
  selected: JobView | null
  drafting: boolean
  text: string
  limit: PaperLimitError | null
  error: string | null
}

export type LetterStartAction =
  | { type: "jobs_loaded"; jobs: JobView[] }
  | { type: "jobs_failed"; message: string }
  | { type: "query_typed"; query: string }
  | { type: "picked_job"; job: JobView }
  | { type: "draft_started" }
  | { type: "draft_text_streamed"; text: string }
  | { type: "draft_limited"; limit: PaperLimitError }
  | { type: "draft_failed"; message: string }
  | { type: "draft_ended" }
  | { type: "blank_failed"; message: string }

export function initialLetterStart(jobs: JobView[]): LetterStartState {
  return {
    jobs,
    query: "",
    selected: null,
    drafting: false,
    text: "",
    limit: null,
    error: null,
  }
}

export function letterStartReducer(
  state: LetterStartState,
  action: LetterStartAction
): LetterStartState {
  switch (action.type) {
    case "jobs_loaded":
      return { ...state, jobs: action.jobs }
    case "jobs_failed":
    case "draft_failed":
    case "blank_failed":
      return { ...state, error: action.message }
    case "query_typed":
      return { ...state, query: action.query }
    case "picked_job":
      return { ...state, selected: action.job }
    case "draft_started":
      return { ...state, limit: null, error: null, drafting: true, text: "" }
    case "draft_text_streamed":
      return { ...state, text: action.text }
    case "draft_limited":
      return { ...state, limit: action.limit }
    case "draft_ended":
      return { ...state, drafting: false }
  }
}
