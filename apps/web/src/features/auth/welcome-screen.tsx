import { useEffect, useReducer } from "react"
import { Check } from "lucide-react"

import { useRunCommand } from "@/lib/contract-client.ts"

import { AUTH_COPY, LANGUAGE_STORAGE_KEY, readLanguage } from "./auth-copy.ts"

const HOLD_MS = 400

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

export function WelcomeScreen({ onDone }: { onDone: () => void }) {
  const runCommand = useRunCommand()
  const [coachReady, markCoachReady] = useReducer(() => true, false)

  useEffect(() => {
    let cancelled = false
    const started = performance.now()

    async function finish() {
      const language = readLanguage()
      if (language === "vi") {
        try {
          await runCommand("profile.update", { language: "vi" })
        } catch {
          // rejected-ok: a failed language post still lets welcome finish.
        }
        sessionStorage.removeItem(LANGUAGE_STORAGE_KEY)
      }
      if (!prefersReducedMotion()) {
        const remain = HOLD_MS - (performance.now() - started)
        if (remain > 0) {
          await new Promise((resolve) => window.setTimeout(resolve, remain))
        }
      }
      if (cancelled) return
      markCoachReady()
      try {
        await runCommand("profile.markWelcomed", {})
      } catch {
        // rejected-ok: the next signed-in load tries welcome again.
      }
      if (!cancelled) onDone()
    }

    void finish()
    return () => {
      cancelled = true
    }
  }, [onDone, runCommand])

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-background px-4 text-foreground">
      <h1 className="text-xl font-semibold">{AUTH_COPY.welcome}</h1>
      <ul className="flex w-full max-w-[340px] flex-col gap-3 text-sm">
        <WelcomeLine done label={AUTH_COPY.accountCreated} />
        <WelcomeLine done label={AUTH_COPY.workspaceReady} />
        <WelcomeLine done={coachReady} label={AUTH_COPY.coachReady} />
      </ul>
    </div>
  )
}

function WelcomeLine({ done, label }: { done: boolean; label: string }) {
  return (
    <li className="flex items-center gap-2">
      {done ? (
        <Check aria-hidden className="size-4" />
      ) : (
        <span
          aria-hidden
          className="size-4 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent motion-reduce:animate-none"
        />
      )}
      <span>{label}</span>
    </li>
  )
}
