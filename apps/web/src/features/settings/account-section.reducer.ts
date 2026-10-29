export type AccountState = {
  photoUrl: string | null
  photoError?: string
  draftName: string | null
  nameError?: string
  emailOpen: boolean
  deleteOpen: boolean
}

export type AccountAction =
  | { type: "photo_rejected"; message: string }
  | { type: "photo_upload_started" }
  | { type: "photo_uploaded"; url: string }
  | { type: "photo_upload_failed"; message: string }
  | { type: "name_typed"; value: string }
  | { type: "name_rejected"; message: string }
  | { type: "name_committed"; name: string }
  | { type: "email_dialog_changed"; open: boolean }
  | { type: "delete_dialog_changed"; open: boolean }

export const ACCOUNT_START: AccountState = {
  photoUrl: null,
  draftName: null,
  emailOpen: false,
  deleteOpen: false,
}

export function accountReducer(
  state: AccountState,
  action: AccountAction
): AccountState {
  switch (action.type) {
    case "photo_rejected":
      return { ...state, photoError: action.message }
    case "photo_upload_started":
      return { ...state, photoError: undefined }
    case "photo_uploaded":
      return { ...state, photoUrl: action.url }
    case "photo_upload_failed":
      return { ...state, photoError: action.message }
    case "name_typed":
      return { ...state, draftName: action.value }
    case "name_rejected":
      return { ...state, nameError: action.message }
    case "name_committed":
      return { ...state, nameError: undefined, draftName: action.name }
    case "email_dialog_changed":
      return { ...state, emailOpen: action.open }
    case "delete_dialog_changed":
      return { ...state, deleteOpen: action.open }
  }
}

export type EmailState = {
  email: string
  error?: string
  pendingEmail: string | null
  code: string
  focusNonce: number
}

export type EmailAction =
  | { type: "email_typed"; value: string }
  | { type: "code_typed"; value: string }
  | { type: "failed"; message: string }
  | { type: "submit_started" }
  | { type: "code_sent"; email: string }
  | { type: "dismissed"; current: string }

export function initialEmailState(current: string): EmailState {
  return { email: current, pendingEmail: null, code: "", focusNonce: 0 }
}

export function emailReducer(
  state: EmailState,
  action: EmailAction
): EmailState {
  switch (action.type) {
    case "email_typed":
      return { ...state, email: action.value }
    case "code_typed":
      return { ...state, code: action.value }
    case "failed":
      return { ...state, error: action.message }
    case "submit_started":
      return { ...state, error: undefined }
    case "code_sent":
      return {
        ...state,
        pendingEmail: action.email,
        focusNonce: state.focusNonce + 1,
      }
    case "dismissed":
      return initialEmailState(action.current)
  }
}
