import { useEffect, useReducer } from "react"
import { Check } from "lucide-react"
import { Spinner } from "@workspace/ui/components/spinner"

import { Mark } from "@workspace/ui/components/brand"

import { useRunCommand } from "@/lib/contract-client.ts"
import { ignoreRejection } from "@/lib/quiet-rejection.ts"

import { AUTH_COPY, LANGUAGE_STORAGE_KEY, readLanguage } from "./auth-copy.ts"
import "./design/welcome.pen.css"

const HOLD_MS = 400

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

export function WelcomeScreen({ onDone }: { onDone: () => void }) {
  const runCommand = useRunCommand()
  const [coachReady, markCoachReady] = useReducer(() => true, false)

  useEffect(() => {
    let cancelled = false
    let holdTimer: number | undefined
    const started = performance.now()

    async function finish() {
      const language = readLanguage()
      if (language === "vi") {
        await ignoreRejection(
          runCommand("profile.update", { language: "vi" }),
          "welcomeLanguagePostMayFail"
        )
        sessionStorage.removeItem(LANGUAGE_STORAGE_KEY)
      }
      if (cancelled) return
      if (!prefersReducedMotion()) {
        const remain = HOLD_MS - (performance.now() - started)
        if (remain > 0) {
          await new Promise((resolve) => {
            holdTimer = window.setTimeout(resolve, remain)
          })
        }
      }
      if (cancelled) return
      markCoachReady()
      await ignoreRejection(
        runCommand("profile.markWelcomed", {}),
        "welcomeRetriesOnNextLoad"
      )
      if (!cancelled) onDone()
    }

    void finish()
    return () => {
      cancelled = true
      window.clearTimeout(holdTimer)
    }
  }, [onDone, runCommand])

  return (
    <main
      data-pen-surface="auth"
      data-slot="welcome"
      className="flex min-h-dvh flex-col items-center justify-center px-4 pb-10"
    >
      <span data-welcome-mark className="inline-flex">
        <Mark size={64} />
      </span>
      <h1
        data-welcome-heading
        className="mt-10 text-center text-[30px] leading-[normal] font-semibold tracking-[-1px]"
      >
        {AUTH_COPY.welcome}
      </h1>
      <ul className="mt-6 flex w-[240px] max-w-full flex-col gap-3">
        <WelcomeLine done label={AUTH_COPY.accountCreated} />
        <WelcomeLine done label={AUTH_COPY.workspaceReady} />
        <WelcomeLine done={coachReady} label={AUTH_COPY.coachReady} />
      </ul>
    </main>
  )
}

function WelcomeLine({ done, label }: { done: boolean; label: string }) {
  return (
    <li
      data-welcome-step={done ? "done" : "pending"}
      className="flex items-center gap-2.5 text-[14.5px] leading-[normal]"
    >
      {done ? (
        <Check aria-hidden strokeWidth={2.5} className="size-[15px] shrink-0" />
      ) : (
        <Spinner aria-hidden className="size-[15px] shrink-0" />
      )}
      <span>{label}</span>
    </li>
  )
}
