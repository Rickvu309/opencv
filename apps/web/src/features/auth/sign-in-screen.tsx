import { useEffect, useState, type FormEvent } from "react"
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
import { endpoints, fetchBinary } from "@/lib/requests.ts"

type Step = "email" | "code" | "verifying"
type Notice = "email" | "bad" | "locked" | "rate" | "send" | null

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
  const [language, setLanguage] = useState(readLanguage)
  const [email, setEmail] = useState(search.email ?? "")
  const [step, setStep] = useState<Step>(search.email ? "code" : "email")
  const [code, setCode] = useState("")
  const [notice, setNotice] = useState<Notice>(null)
  const [googleNotice, setGoogleNotice] = useState(search.error === "google")
  const [google, setGoogle] = useState(false)
  const [sending, setSending] = useState(false)
  const [seconds, setSeconds] = useState(search.email ? 60 : 0)
  const [focusNonce, setFocusNonce] = useState(search.email ? 1 : 0)

  useEffect(() => {
    let cancelled = false
    void fetchBinary(endpoints.publicConfig)
      .then(async (res) => {
        if (!res.ok) return false
        const body = (await res.json()) as { google?: boolean }
        return body.google === true
      })
      .then((enabled) => {
        if (!cancelled) setGoogle(enabled)
      })
      .catch(() => {
        if (!cancelled) setGoogle(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (step !== "code" || seconds <= 0) return
    const timer = window.setInterval(() => {
      setSeconds((current) => (current <= 1 ? 0 : current - 1))
    }, 1000)
    return () => window.clearInterval(timer)
  }, [step, seconds])

  function chooseLanguage(value: "en" | "vi") {
    setLanguage(value)
    storeLanguage(value)
  }

  async function sendCode(address: string) {
    setSending(true)
    setNotice(null)
    try {
      const result = await authClient.emailOtp.sendVerificationOtp({
        email: address,
        type: "sign-in",
      })
      if (result.error) {
        setNotice(noticeForSend(result.error))
        return false
      }
      setEmail(address)
      setCode("")
      setStep("code")
      setSeconds(60)
      setFocusNonce((nonce) => nonce + 1)
      return true
    } catch {
      setNotice("send")
      return false
    } finally {
      setSending(false)
    }
  }

  async function onContinue(event: FormEvent) {
    event.preventDefault()
    const address = email.trim()
    if (!EMAIL_PATTERN.test(address)) {
      setNotice("email")
      return
    }
    await sendCode(address)
  }

  async function onComplete(otp: string) {
    if (step === "verifying") return
    setStep("verifying")
    setNotice(null)
    try {
      const result = await authClient.signIn.emailOtp({
        email: email.trim(),
        otp,
      })
      if (result.error) {
        const next = noticeForCode(result.error)
        setNotice(next)
        setCode("")
        setStep("code")
        setSeconds(next === "bad" || next === "locked" ? 0 : seconds)
        setFocusNonce((nonce) => nonce + 1)
        return
      }
      await navigate({ href: redirectTo ?? "/app" })
    } catch {
      setNotice("send")
      setCode("")
      setStep("code")
      setFocusNonce((nonce) => nonce + 1)
    }
  }

  async function onGoogle() {
    setGoogleNotice(false)
    const path = redirectTo ?? "/app"
    const callbackURL = new URL(path, window.location.origin).href
    const result = await authClient.signIn.social({
      provider: "google",
      callbackURL,
      newUserCallbackURL: callbackURL,
      errorCallbackURL: new URL("/sign-in?error=google", window.location.origin)
        .href,
    })
    if (result.error) setGoogleNotice(true)
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
          <h1 className="text-center text-[26px] font-semibold tracking-[-0.7px]">
            {"Log in to "}
            <Brand size={26} />
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
              onChange={(event) => setEmail(event.currentTarget.value)}
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
              onChange={setCode}
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
              setStep("email")
              setNotice(null)
              setCode("")
              setSeconds(0)
            }}
          >
            {AUTH_COPY.change}
          </Button>
        </div>
      )}
    </AuthFrame>
  )
}
