export type ScanProgress = {
  emails: number | null
  companies: number | null
  names: string[]
}

export type InboxState = {
  openId: string | null
  view: "inbox" | "snoozed"
  scanning: ScanProgress | null
  skipping: boolean
}

export type InboxAction =
  | { type: "view_changed"; view: "inbox" | "snoozed" }
  | { type: "thread_opened"; id: string }
  | { type: "thread_closed" }
  | { type: "skip_started" }
  | { type: "skip_ended" }
  | { type: "scan_started" }
  | { type: "scan_found"; progress: ScanProgress }
  | { type: "scan_ended" }
  | { type: "explore_started" }
  | { type: "explore_failed" }

export const INBOX_START: InboxState = {
  openId: null,
  view: "inbox",
  scanning: null,
  skipping: false,
}

export function inboxReducer(
  state: InboxState,
  action: InboxAction
): InboxState {
  switch (action.type) {
    case "view_changed":
      return { ...state, view: action.view, openId: null }
    case "thread_opened":
      return { ...state, openId: action.id }
    case "thread_closed":
      return { ...state, openId: null }
    case "skip_started":
      return { ...state, skipping: true }
    case "skip_ended":
      return { ...state, skipping: false }
    case "scan_started":
      return {
        ...state,
        scanning: { emails: null, companies: null, names: [] },
      }
    case "scan_found":
      return { ...state, scanning: action.progress }
    case "scan_ended":
      return { ...state, scanning: null, skipping: false }
    case "explore_started":
      return {
        ...state,
        skipping: true,
        scanning: { emails: null, companies: null, names: [] },
      }
    case "explore_failed":
      return { ...state, skipping: false, scanning: null }
  }
}
