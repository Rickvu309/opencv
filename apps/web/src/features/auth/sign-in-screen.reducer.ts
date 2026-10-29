export type Step = "email" | "code" | "verifying"
export type Notice = "email" | "bad" | "locked" | "rate" | "send" | null
type Language = "en" | "vi"

export type SignInState = {
  language: Language
  email: string
  step: Step
  code: string
  notice: Notice
  googleNotice: boolean
  google: boolean
  sending: boolean
  seconds: number
  focusNonce: number
}

export type SignInAction =
  | { type: "language_chosen"; language: Language }
  | { type: "email_typed"; value: string }
  | { type: "code_typed"; value: string }
  | { type: "email_invalid" }
  | { type: "send_started" }
  | { type: "send_succeeded"; address: string }
  | { type: "send_rejected"; notice: Notice }
  | { type: "send_settled" }
  | { type: "verify_started" }
  | { type: "verify_rejected"; notice: Notice }
  | { type: "verify_failed" }
  | { type: "email_change_requested" }
  | { type: "resend_ticked" }
  | { type: "google_config_loaded"; enabled: boolean }
  | { type: "google_started" }
  | { type: "google_failed" }

export function initSignInState(
  search: { email?: string; error?: string },
  language: Language
): SignInState {
  return {
    language,
    email: search.email ?? "",
    step: search.email ? "code" : "email",
    code: "",
    notice: null,
    googleNotice: search.error === "google",
    google: false,
    sending: false,
    seconds: search.email ? 60 : 0,
    focusNonce: search.email ? 1 : 0,
  }
}

export function signInReducer(
  state: SignInState,
  action: SignInAction
): SignInState {
  switch (action.type) {
    case "language_chosen":
      return { ...state, language: action.language }
    case "email_typed":
      return { ...state, email: action.value }
    case "code_typed":
      return { ...state, code: action.value }
    case "email_invalid":
      return { ...state, notice: "email" }
    case "send_started":
      return { ...state, sending: true, notice: null }
    case "send_succeeded":
      return {
        ...state,
        email: action.address,
        code: "",
        step: "code",
        seconds: 60,
        focusNonce: state.focusNonce + 1,
      }
    case "send_rejected":
      return { ...state, notice: action.notice }
    case "send_settled":
      return { ...state, sending: false }
    case "verify_started":
      return { ...state, step: "verifying", notice: null }
    case "verify_rejected":
      return {
        ...state,
        notice: action.notice,
        code: "",
        step: "code",
        seconds:
          action.notice === "bad" || action.notice === "locked"
            ? 0
            : state.seconds,
        focusNonce: state.focusNonce + 1,
      }
    case "verify_failed":
      return {
        ...state,
        notice: "send",
        code: "",
        step: "code",
        focusNonce: state.focusNonce + 1,
      }
    case "email_change_requested":
      return { ...state, step: "email", notice: null, code: "", seconds: 0 }
    case "resend_ticked":
      return { ...state, seconds: state.seconds <= 1 ? 0 : state.seconds - 1 }
    case "google_config_loaded":
      return { ...state, google: action.enabled }
    case "google_started":
      return { ...state, googleNotice: false }
    case "google_failed":
      return { ...state, googleNotice: true }
  }
}
