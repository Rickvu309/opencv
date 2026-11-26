import type { JobView } from "@workspace/domain/apply"
import type { LetterAttachmentContext } from "@workspace/domain/paper-doc"

import type { PaperLimitError } from "./paper-api.ts"

export type LetterStartState = {
  attachment:
    | { status: "empty" }
    | { status: "loading"; previous: LetterAttachmentContext | null }
    | { status: "ready"; context: LetterAttachmentContext }
  jobs: JobView[]
  query: string
  selected: JobView | null
  drafting: boolean
  text: string
  limit: PaperLimitError | null
  error: string | null
}

export type LetterStartAction =
  | { type: "attachment_started" }
  | { type: "attachment_loaded"; context: LetterAttachmentContext }
  | { type: "attachment_removed" }
  | { type: "attachment_failed"; message: string }
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
    attachment: { status: "empty" },
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
    case "attachment_started":
      return {
        ...state,
        attachment: {
          status: "loading",
          previous:
            state.attachment.status === "ready"
              ? state.attachment.context
              : null,
        },
        error: null,
      }
    case "attachment_loaded":
      return {
        ...state,
        attachment: { status: "ready", context: action.context },
        error: null,
      }
    case "attachment_removed":
      return { ...state, attachment: { status: "empty" }, error: null }
    case "attachment_failed":
      return {
        ...state,
        attachment:
          state.attachment.status === "loading" && state.attachment.previous
            ? { status: "ready", context: state.attachment.previous }
            : { status: "empty" },
        error: action.message,
      }
    case "jobs_loaded":
      return { ...state, jobs: action.jobs }
    case "jobs_failed":
    case "draft_failed":
    case "blank_failed":
      return { ...state, error: action.message }
    case "query_typed":
      return {
        ...state,
        query: action.query,
        selected:
          state.selected &&
          `${state.selected.title} ${state.selected.company}`
            .toLowerCase()
            .includes(action.query.trim().toLowerCase())
            ? state.selected
            : null,
      }
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
