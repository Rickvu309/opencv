import { useEffect, useReducer, type FormEvent } from "react"
import { useNavigate, useRouterState } from "@tanstack/react-router"
import { Brand } from "@workspace/ui/components/brand"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"

import { authClient } from "@/lib/auth-client.ts"
import { redirectFromSearch } from "@/lib/auth-redirect.ts"

import { AuthFrame } from "./auth-frame.tsx"
import {
  AUTH_COPY,
  EMAIL_PATTERN,
  openEmailHref,
  readLanguage,
  resendLabel,
  storeLanguage,
} from "./auth-copy.ts"
import { CodeInput } from "./code-input.tsx"
import googleG from "./google-g.svg?url"
import {
  initSignInState,
  signInReducer,
  type Notice,
} from "./sign-in-screen.reducer.ts"
import { endpoints, fetchBinary } from "@/lib/requests.ts"

type AuthError = {
  code?: string
  status?: number
  message?: string
} | null

const NOTICE = {
  email: AUTH_COPY.emailInvalid,
  bad: AUTH_COPY.codeBad,
  locked: AUTH_COPY.tooManyTries,
  rate: AUTH_COPY.tooManyCodes,
  send: AUTH_COPY.sendFailed,
} as const

function noticeForSend(error: AuthError): Notice {
  if (error?.status === 429) return "rate"
  if (error?.status === 400) return "email"
  return "send"
}

function noticeForCode(error: AuthError): Notice {
  if (error?.code === "TOO_MANY_ATTEMPTS" || error?.status === 403)
    return "locked"
  if (error?.status === 429) return "rate"
  if (error?.code === "INVALID_OTP" || error?.code === "OTP_EXPIRED")
    return "bad"
  return "send"
}

export function SignInScreen() {
  const navigate = useNavigate()
  const redirectTo = useRouterState({
    select: (state) => redirectFromSearch(state.location.search),
  })
  const search = useRouterState({
    select: (state) =>
      state.location.search as { email?: string; error?: string },
  })
  const [
    {
      language,
      email,
      step,
      code,
      notice,
      googleNotice,
      google,
      sending,
      seconds,
      focusNonce,
    },
    dispatch,
  ] = useReducer(signInReducer, undefined, () =>
    initSignInState(search, readLanguage())
  )

  useEffect(() => {
    let cancelled = false
    void fetchBinary(endpoints.publicConfig)
      .then(async (res) => {
        if (!res.ok) return false
        const body = (await res.json()) as { google?: boolean }
        return body.google === true
      })
      .then((enabled) => {
        if (!cancelled) dispatch({ type: "google_config_loaded", enabled })
      })
      .catch(() => {
        if (!cancelled)
          dispatch({ type: "google_config_loaded", enabled: false })
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (step !== "code" || seconds <= 0) return
    const timer = window.setInterval(() => {
      dispatch({ type: "resend_ticked" })
    }, 1000)
    return () => window.clearInterval(timer)
  }, [step, seconds])

  function chooseLanguage(value: "en" | "vi") {
    dispatch({ type: "language_chosen", language: value })
    storeLanguage(value)
  }

  async function sendCode(address: string) {
    dispatch({ type: "send_started" })
    try {
      const result = await authClient.emailOtp.sendVerificationOtp({
        email: address,
        type: "sign-in",
      })
      if (result.error) {
        dispatch({ type: "send_rejected", notice: noticeForSend(result.error) })
        return false
      }
      dispatch({ type: "send_succeeded", address })
      return true
    } catch {
      dispatch({ type: "send_rejected", notice: "send" })
      return false
    } finally {
      dispatch({ type: "send_settled" })
    }
  }

  async function onContinue(event: FormEvent) {
    event.preventDefault()
    const address = email.trim()
    if (!EMAIL_PATTERN.test(address)) {
      dispatch({ type: "email_invalid" })
      return
    }
    await sendCode(address)
  }

  async function onComplete(otp: string) {
    if (step === "verifying") return
    dispatch({ type: "verify_started" })
    try {
      const result = await authClient.signIn.emailOtp({
        email: email.trim(),
        otp,
      })
      if (result.error) {
        const next = noticeForCode(result.error)
        dispatch({ type: "verify_rejected", notice: next })
        return
      }
      await navigate({ href: redirectTo ?? "/" })
    } catch {
      dispatch({ type: "verify_failed" })
    }
  }

  async function onGoogle() {
    dispatch({ type: "google_started" })
    const path = redirectTo ?? "/"
    const callbackURL = new URL(path, window.location.origin).href
    const result = await authClient.signIn.social({
      provider: "google",
      callbackURL,
      newUserCallbackURL: callbackURL,
      errorCallbackURL: new URL("/sign-in?error=google", window.location.origin)
        .href,
    })
    if (result.error) dispatch({ type: "google_failed" })
  }

  const inbox = openEmailHref(email)
  const showResend =
    step === "code" &&
    (seconds === 0 ||
      notice === "bad" ||
      notice === "locked" ||
      notice === "rate" ||
      notice === "send")
  const noticeText = notice ? NOTICE[notice] : null

  const codeAreas =
    step === "verifying"
      ? "[grid-template-areas:'title_title_title_title'_'sent_sent_sent_sent'_'._email_change_.'_'digits_digits_digits_digits'_'follow_follow_follow_follow']"
      : noticeText || inbox
        ? "[grid-template-areas:'title_title_title_title'_'sent_sent_sent_sent'_'._email_change_.'_'digits_digits_digits_digits'_'follow_follow_follow_follow'_'resend_resend_resend_resend']"
        : "[grid-template-areas:'title_title_title_title'_'sent_sent_sent_sent'_'._email_change_.'_'digits_digits_digits_digits'_'resend_resend_resend_resend']"

  return (
    <AuthFrame language={language} onLanguage={chooseLanguage}>
      {step === "email" ? (
        <form className="flex w-full flex-col gap-6" onSubmit={onContinue}>
          <h1 className="flex flex-wrap items-center justify-center gap-x-2 text-[26px] font-semibold tracking-[-0.7px]">
            <span>Log in to</span> <Brand size={26} />
          </h1>
          {googleNotice ? (
            <p role="alert" className="text-center text-sm text-destructive">
              {AUTH_COPY.googleUnavailable}
            </p>
          ) : null}
          {google ? (
            <>
              <Button
                type="button"
                className="h-[46px] w-full rounded-[10px]"
                onClick={() => void onGoogle()}
              >
                <img src={googleG} alt="" className="size-4" />
                {AUTH_COPY.google}
              </Button>
              <div className="flex w-full items-center gap-3">
                <span className="h-px flex-1 bg-border" />
                <span className="text-xs text-muted-foreground">
                  {AUTH_COPY.or}
                </span>
                <span className="h-px flex-1 bg-border" />
              </div>
            </>
          ) : null}
          <div className="flex w-full flex-col gap-1.5">
            <Label htmlFor="sign-in-email" className="text-[13px] font-medium">
              {AUTH_COPY.email}
            </Label>
            <Input
              id="sign-in-email"
              type="email"
              autoComplete="email"
              placeholder={AUTH_COPY.emailPlaceholder}
              value={email}
              onChange={(event) =>
                dispatch({
                  type: "email_typed",
                  value: event.currentTarget.value,
                })
              }
              className="h-[46px] rounded-[10px] px-3.5 text-[15px] md:text-[15px]"
            />
          </div>
          {noticeText ? (
            <p role="alert" className="text-sm text-destructive">
              {noticeText}
            </p>
          ) : null}
          <Button
            type="submit"
            variant="glow"
            className="h-[46px] w-full rounded-[10px]"
            disabled={sending}
          >
            {AUTH_COPY.continue}
          </Button>
        </form>
      ) : (
        <div
          className={`grid w-full grid-cols-[1fr_auto_auto_1fr] items-center gap-x-2 gap-y-2 ${codeAreas}`}
        >
          <h1 className="text-center text-[26px] font-semibold tracking-[-0.7px] [grid-area:title]">
            {AUTH_COPY.checkEmail}
          </h1>
          <p className="text-center text-sm text-muted-foreground [grid-area:sent]">
            {AUTH_COPY.sentTo}
          </p>
          <span className="max-w-56 truncate font-semibold [grid-area:email]">
            {email}
          </span>
          <div className="mbs-4 w-full [grid-area:digits]">
            <CodeInput
              value={code}
              disabled={step === "verifying"}
              focusNonce={focusNonce}
              onChange={(value) => dispatch({ type: "code_typed", value })}
              onComplete={(otp) => void onComplete(otp)}
            />
          </div>
          {step === "verifying" ? (
            <p
              className="mbs-4 flex items-center justify-center gap-2 text-sm text-muted-foreground [grid-area:follow]"
              role="status"
            >
              <span
                aria-hidden
                className="size-4 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent motion-reduce:animate-none"
              />
              {AUTH_COPY.verifying}
            </p>
          ) : noticeText || inbox ? (
            <div className="mbs-4 flex flex-col items-center gap-4 [grid-area:follow]">
              {noticeText ? (
                <p role="alert" className="text-sm text-destructive">
                  {noticeText}
                </p>
              ) : null}
              {inbox ? (
                <a
                  href={inbox}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm font-medium underline-offset-4 hover:underline"
                >
                  {AUTH_COPY.openEmail}
                </a>
              ) : null}
            </div>
          ) : null}
          {step === "verifying" ? null : (
            <div className="mbs-4 flex items-center justify-center gap-2 text-sm text-muted-foreground [grid-area:resend]">
              <span>{AUTH_COPY.didntGet}</span>
              {showResend ? (
                <Button
                  type="button"
                  variant="outline"
                  disabled={sending}
                  onClick={() => void sendCode(email.trim())}
                >
                  {AUTH_COPY.sendNew}
                </Button>
              ) : (
                <span>{resendLabel(seconds)}</span>
              )}
            </div>
          )}
          <Button
            type="button"
            variant="ghost"
            className="h-auto px-1 py-0 text-sm font-medium text-muted-foreground [grid-area:change]"
            onClick={() => {
              dispatch({ type: "email_change_requested" })
            }}
          >
            {AUTH_COPY.change}
          </Button>
        </div>
      )}
    </AuthFrame>
  )
}
