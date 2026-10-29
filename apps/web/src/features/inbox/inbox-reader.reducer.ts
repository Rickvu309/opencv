import type { InboxLimitError } from "./inbox-api.ts"

export type ReaderState = {
  body: string
  savedBody: string
  receivedBody: string
  selected: number
  limit: InboxLimitError | null
  busy: boolean
  opened: ReadonlySet<string>
}

export type ReaderAction =
  | { type: "reply_typed"; value: string }
  | { type: "draft_received"; body: string }
  | { type: "time_chosen"; index: number; body: string }
  | { type: "draft_saved"; body: string }
  | { type: "reply_suggested"; body: string }
  | { type: "limit_reached"; limit: InboxLimitError }
  | { type: "task_started" }
  | { type: "task_ended" }
  | { type: "earlier_toggled"; id: string }

export function initialReaderState(saved: string): ReaderState {
  return {
    body: saved,
    savedBody: saved,
    receivedBody: saved,
    selected: 0,
    limit: null,
    busy: false,
    opened: new Set(),
  }
}

export function readerReducer(
  state: ReaderState,
  action: ReaderAction
): ReaderState {
  switch (action.type) {
    case "reply_typed":
      return { ...state, body: action.value }
    case "draft_received":
      return {
        ...state,
        body: state.body === state.savedBody ? action.body : state.body,
        savedBody: action.body,
        receivedBody: action.body,
      }
    case "time_chosen":
      return {
        ...state,
        selected: action.index,
        body: action.body,
        savedBody: action.body,
      }
    case "draft_saved":
      return { ...state, savedBody: action.body }
    case "reply_suggested":
      return {
        ...state,
        body: action.body,
        savedBody: action.body,
        limit: null,
      }
    case "limit_reached":
      return { ...state, limit: action.limit }
    case "task_started":
      return { ...state, busy: true }
    case "task_ended":
      return { ...state, busy: false }
    case "earlier_toggled": {
      const opened = new Set(state.opened)
      if (!opened.delete(action.id)) opened.add(action.id)
      return { ...state, opened }
    }
  }
}
