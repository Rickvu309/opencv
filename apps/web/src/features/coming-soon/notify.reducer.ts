export type NotifyState = { pending: boolean; error: string | null }

export type NotifyAction =
  | { type: "requested" }
  | { type: "failed"; message: string }
  | { type: "settled" }

export const initialNotifyState: NotifyState = { pending: false, error: null }

export function notifyReducer(
  state: NotifyState,
  action: NotifyAction
): NotifyState {
  switch (action.type) {
    case "requested":
      return { pending: true, error: null }
    case "failed":
      return { ...state, error: action.message }
    case "settled":
      return { ...state, pending: false }
  }
}
