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
  storeLanguage,
} from "./auth-copy.ts"
import { EmailCodeScreen } from "./email-code-screen.tsx"
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
        <EmailCodeScreen
          email={email}
          code={code}
          state={step}
          invalid={notice === "bad"}
          notice={noticeText}
          inbox={inbox}
          seconds={seconds}
          sending={sending}
          showResend={showResend}
          focusNonce={focusNonce}
          onChange={(value) => dispatch({ type: "code_typed", value })}
          onComplete={(otp) => void onComplete(otp)}
          onResend={() => void sendCode(email.trim())}
          onChangeEmail={() => dispatch({ type: "email_change_requested" })}
        />
      )}
    </AuthFrame>
  )
}
