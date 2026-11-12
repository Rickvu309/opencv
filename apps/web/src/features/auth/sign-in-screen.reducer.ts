export type Step = "email" | "code" | "verifying"
export type Notice = "email" | "bad" | "locked" | "rate" | "send" | null
type Language = "en" | "vi"

export type SignInState = {
  language: Language
  email: string
  step: Step
  code: string
  notice: Notice
  waitMinutes: number | null
  googleNotice: boolean
  google: boolean
  sending: boolean
  seconds: number
  focusNonce: number
  emailFocusNonce: number
  now: number
  holds: CodeLimitHolds
  refusedAddress: string | null
}

export type CodeLimitHold = { endsAt: number; serverEndsAt: number }
export type CodeLimitHolds = Readonly<Record<string, CodeLimitHold>>

export const LONGEST_CODE_LIMIT_HOLD_MS = 60 * 60_000
export const MOST_HELD_ADDRESSES = 5

export function addressKey(address: string) {
  return address.trim().toLowerCase()
}

export function codeLimitHoldMs(waitMinutes: number | null): number | null {
  if (waitMinutes === null || !Number.isFinite(waitMinutes) || waitMinutes <= 0)
    return null
  return Math.min(Math.ceil(waitMinutes * 60_000), LONGEST_CODE_LIMIT_HOLD_MS)
}

export function codeLimitLeftMs(
  holds: CodeLimitHolds,
  address: string,
  now: number
): number {
  const hold = holds[addressKey(address)]
  if (hold === undefined) return 0
  const left = hold.endsAt - now
  if (left <= 0) return 0
  return Math.min(left, LONGEST_CODE_LIMIT_HOLD_MS)
}

export function codeLimitServerMinutes(
  holds: CodeLimitHolds,
  address: string,
  now: number
): number | null {
  const hold = holds[addressKey(address)]
  if (hold === undefined || hold.serverEndsAt <= now) return null
  return Math.ceil((hold.serverEndsAt - now) / 60_000)
}

function withHold(
  holds: CodeLimitHolds,
  address: string,
  hold: CodeLimitHold
): CodeLimitHolds {
  const key = addressKey(address)
  const kept = Object.entries(holds).filter(([held]) => held !== key)
  return Object.fromEntries(
    [...kept, [key, hold] as const].slice(-MOST_HELD_ADDRESSES)
  )
}

function liveHolds(holds: CodeLimitHolds, now: number): CodeLimitHolds {
  const live = Object.entries(holds).filter(([, hold]) => hold.endsAt > now)
  return live.length === Object.keys(holds).length
    ? holds
    : Object.fromEntries(live)
}

function emailStepNotice(state: SignInState, address: string): SignInState {
  const key = addressKey(address)
  if (codeLimitLeftMs(state.holds, key, state.now) > 0)
    return { ...state, notice: "rate", refusedAddress: key, waitMinutes: null }
  if (state.notice === "rate" && state.refusedAddress !== key)
    return { ...state, notice: null, refusedAddress: null }
  return state
}

export type SignInAction =
  | { type: "language_chosen"; language: Language }
  | { type: "email_typed"; value: string; now: number }
  | { type: "code_typed"; value: string }
  | { type: "email_invalid" }
  | { type: "send_started" }
  | { type: "send_succeeded"; address: string }
  | {
      type: "send_rejected"
      notice: Notice
      waitMinutes?: number | null
      address?: string
      now?: number
    }
  | { type: "send_settled" }
  | { type: "verify_started" }
  | { type: "verify_rejected"; notice: Notice; waitMinutes?: number | null }
  | { type: "verify_failed" }
  | { type: "email_change_requested"; now: number }
  | { type: "clock_ticked"; now: number }
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
    waitMinutes: null,
    googleNotice: Boolean(search.error),
    google: false,
    sending: false,
    seconds: search.email ? 60 : 0,
    focusNonce: search.email ? 1 : 0,
    emailFocusNonce: 0,
    now: 0,
    holds: {},
    refusedAddress: null,
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
      return emailStepNotice(
        { ...state, email: action.value, now: action.now },
        action.value
      )
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
    case "send_rejected": {
      const waitMinutes = action.waitMinutes ?? null
      const holdMs = codeLimitHoldMs(waitMinutes)
      const refused = action.address === undefined ? null : action.address
      const now = action.now ?? state.now
      return {
        ...state,
        notice: action.notice,
        waitMinutes,
        now,
        refusedAddress: refused === null ? null : addressKey(refused),
        holds:
          action.notice === "rate" && holdMs !== null && refused !== null
            ? withHold(liveHolds(state.holds, now), refused, {
                endsAt: now + holdMs,
                serverEndsAt: now + (waitMinutes ?? 0) * 60_000,
              })
            : state.holds,
      }
    }
    case "send_settled":
      return { ...state, sending: false }
    case "verify_started":
      return { ...state, step: "verifying", notice: null }
    case "verify_rejected":
      return {
        ...state,
        notice: action.notice,
        waitMinutes: action.waitMinutes ?? null,
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
      return emailStepNotice(
        {
          ...state,
          step: "email",
          notice: null,
          refusedAddress: null,
          code: "",
          seconds: 0,
          now: action.now,
          emailFocusNonce: state.emailFocusNonce + 1,
        },
        state.email
      )
    case "clock_ticked": {
      const ended =
        state.step === "email" &&
        state.notice === "rate" &&
        state.refusedAddress !== null &&
        state.holds[state.refusedAddress] !== undefined &&
        codeLimitLeftMs(state.holds, state.refusedAddress, action.now) === 0
      return {
        ...state,
        now: action.now,
        holds: liveHolds(state.holds, action.now),
        ...(ended ? { notice: null, refusedAddress: null } : {}),
      }
    }
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
