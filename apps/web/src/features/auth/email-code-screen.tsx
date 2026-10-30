import { CircleAlert, LoaderCircle, Mail } from "lucide-react"
import { Button } from "@workspace/ui/components/button"

import { AUTH_COPY, resendLabel } from "./auth-copy.ts"
import { CodeInput } from "./code-input.tsx"
import "./design/email-code.pen.css"

export function EmailCodeScreen({
  email,
  code,
  state,
  invalid,
  notice,
  inbox,
  seconds,
  sending,
  showResend,
  focusNonce,
  onChange,
  onComplete,
  onResend,
  onChangeEmail,
}: {
  email: string
  code: string
  state: "code" | "verifying"
  invalid: boolean
  notice: string | null
  inbox: string | null
  seconds: number
  sending: boolean
  showResend: boolean
  focusNonce: number
  onChange: (value: string) => void
  onComplete: (code: string) => void
  onResend: () => void
  onChangeEmail: () => void
}) {
  return (
    <section
      data-pen-surface="auth"
      data-slot="email-code-screen"
      className="flex min-h-[360px] w-full flex-col items-center gap-6"
    >
      <div className="flex w-full flex-col items-center gap-2">
        <h1 className="text-center text-[26px] leading-[31px] font-semibold tracking-[-0.7px]">
          {AUTH_COPY.checkEmail}
        </h1>
        <p
          data-slot="email-code-sent"
          className="text-center text-[14.5px] leading-[17.5px]"
        >
          {AUTH_COPY.sentTo}
        </p>
        <div className="flex max-w-full min-w-0 items-center gap-2">
          <span
            data-slot="email-code-address"
            className="min-w-0 truncate text-[14.5px] leading-[17.5px] font-semibold"
          >
            {email}
          </span>
          <Button
            type="button"
            variant="ghost"
            data-slot="email-code-change"
            className="h-auto shrink-0 rounded border-0 px-0 py-0 text-[13.5px] leading-4 font-medium"
            onClick={onChangeEmail}
          >
            {AUTH_COPY.change}
          </Button>
        </div>
      </div>
      <CodeInput
        value={code}
        disabled={state === "verifying"}
        invalid={invalid}
        focusNonce={focusNonce}
        onChange={onChange}
        onComplete={onComplete}
      />
      {state === "verifying" ? (
        <p
          role="status"
          data-slot="email-code-verifying"
          className="flex h-[42px] items-center justify-center gap-2 text-[13.5px] leading-4 font-medium"
        >
          <LoaderCircle
            aria-hidden
            className="size-4 animate-spin motion-reduce:animate-none"
          />
          {AUTH_COPY.verifying}
        </p>
      ) : (
        <>
          {notice ? (
            <p
              role="alert"
              data-slot="email-code-error"
              className="flex items-center gap-1.5 text-[13px] leading-[15.5px]"
            >
              <CircleAlert aria-hidden className="size-[15px] shrink-0" />
              {notice}
            </p>
          ) : null}
          {inbox ? (
            <Button
              nativeButton={false}
              role="link"
              render={<a href={inbox} target="_blank" rel="noreferrer" />}
              variant="outline"
              data-slot="email-code-open"
              className="h-[42px] w-full gap-2 rounded-[10px] text-[13.5px] leading-4 font-medium"
            >
              <Mail aria-hidden className="size-4" />
              {AUTH_COPY.openEmail}
            </Button>
          ) : null}
          <div
            data-slot="email-code-resend"
            className="flex flex-wrap items-center justify-center gap-1 text-[13px] leading-[15.5px]"
          >
            <span>{AUTH_COPY.didntGet}</span>
            {showResend ? (
              <Button
                type="button"
                variant="ghost"
                data-slot="email-code-send"
                className="h-auto rounded px-0 py-0 text-[13px] leading-[15.5px] font-semibold"
                disabled={sending}
                onClick={onResend}
              >
                {AUTH_COPY.sendNew}
              </Button>
            ) : (
              <span data-slot="email-code-countdown" className="font-medium">
                {resendLabel(seconds)}
              </span>
            )}
          </div>
        </>
      )}
    </section>
  )
}
