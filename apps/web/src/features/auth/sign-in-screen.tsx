import { useEffect, useReducer, useRef, type FormEvent } from "react"
import { useNavigate, useRouterState } from "@tanstack/react-router"
import { Mark } from "@workspace/ui/components/brand"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"

import { authClient } from "@/lib/auth-client.ts"
import { captureRetryAfter } from "@/lib/retry-after.ts"
import { redirectFromSearch } from "@/lib/auth-redirect.ts"

import { AuthFrame } from "./auth-frame.tsx"
import {
  AUTH_COPY,
  EMAIL_PATTERN,
  openEmailHref,
  readLanguage,
  storeLanguage,
  tooManyCodesText,
} from "./auth-copy.ts"
import { EmailCodeScreen } from "./email-code-screen.tsx"
import googleG from "./google-g.svg?url"
import {
  codeLimitLeftMs,
  codeLimitServerMinutes,
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
      waitMinutes,
      emailFocusNonce,
      now,
      holds,
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

  const emailRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (emailFocusNonce === 0) return
    emailRef.current?.focus()
  }, [emailFocusNonce])

  const codeLimitLeft =
    step === "email" ? codeLimitLeftMs(holds, email, now) : 0
  const codeLimitHeld = codeLimitLeft > 0

  useEffect(() => {
    if (!codeLimitHeld) return
    const tick = () => dispatch({ type: "clock_ticked", now: Date.now() })
    const timer = window.setInterval(tick, 1000)
    document.addEventListener("visibilitychange", tick)
    window.addEventListener("focus", tick)
    window.addEventListener("pageshow", tick)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener("visibilitychange", tick)
      window.removeEventListener("focus", tick)
      window.removeEventListener("pageshow", tick)
    }
  }, [codeLimitHeld])

  function chooseLanguage(value: "en" | "vi") {
    dispatch({ type: "language_chosen", language: value })
    storeLanguage(value)
  }

  async function sendCode(address: string) {
    dispatch({ type: "send_started" })
    const wait = captureRetryAfter()
    try {
      const result = await authClient.emailOtp.sendVerificationOtp({
        email: address,
        type: "sign-in",
        fetchOptions: wait.fetchOptions,
      })
      if (result.error) {
        dispatch({
          type: "send_rejected",
          notice: noticeForSend(result.error),
          waitMinutes: wait.minutes(Date.now()),
          address,
          now: Date.now(),
        })
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
      emailRef.current?.focus()
      return
    }
    await sendCode(address)
  }

  async function onComplete(otp: string) {
    if (step === "verifying") return
    dispatch({ type: "verify_started" })
    try {
      const wait = captureRetryAfter()
      const result = await authClient.signIn.emailOtp({
        email: email.trim(),
        otp,
        fetchOptions: wait.fetchOptions,
      })
      if (result.error) {
        const next = noticeForCode(result.error)
        dispatch({
          type: "verify_rejected",
          notice: next,
          waitMinutes: wait.minutes(Date.now()),
        })
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
  const fieldRefused = step === "email" && notice === "email"
  const noticeText =
    notice === "rate"
      ? tooManyCodesText(
          codeLimitHeld
            ? codeLimitServerMinutes(holds, email, now)
            : waitMinutes
        )
      : notice
        ? NOTICE[notice]
        : null

  return (
    <AuthFrame language={language} onLanguage={chooseLanguage}>
      {step === "email" ? (
        <form
          noValidate
          className="flex w-full flex-col gap-6"
          onSubmit={onContinue}
        >
          <h1
            data-slot="sign-in-title"
            className="flex flex-col items-center gap-4 text-center text-[26px] leading-[31px] font-semibold tracking-[-0.7px]"
          >
            <Mark size={32} />
            <span>{AUTH_COPY.logIn}</span>
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
              ref={emailRef}
              id="sign-in-email"
              type="email"
              autoComplete="email"
              placeholder={AUTH_COPY.emailPlaceholder}
              value={email}
              onChange={(event) =>
                dispatch({
                  type: "email_typed",
                  value: event.currentTarget.value,
                  now: Date.now(),
                })
              }
              aria-invalid={fieldRefused || undefined}
              aria-describedby={fieldRefused ? "sign-in-notice" : undefined}
              className="h-[46px] rounded-[10px] px-3.5 text-base md:text-[15px]"
            />
          </div>
          {noticeText ? (
            <p
              id="sign-in-notice"
              role="alert"
              className="text-sm text-destructive"
            >
              {noticeText}
            </p>
          ) : null}
          <Button
            type="submit"
            variant="primary"
            data-slot="sign-in-continue"
            className="h-[46px] w-full rounded-[10px] text-sm font-medium"
            disabled={sending || codeLimitHeld}
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
          onChangeEmail={() =>
            dispatch({ type: "email_change_requested", now: Date.now() })
          }
          onBack={() =>
            dispatch({ type: "email_change_requested", now: Date.now() })
          }
        />
      )}
    </AuthFrame>
  )
}
