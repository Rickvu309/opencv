import { useCallback, useEffect, useState, type ReactNode } from "react"

import { apiFetch, setSessionExpiredListener } from "@/lib/api.ts"
import { authClient } from "@/lib/auth-client.ts"
import { SIGNED_OUT_EMAIL_KEY } from "@/lib/auth-redirect.ts"
import { SessionExpiredDialog } from "./session-expired-dialog.tsx"
import { WelcomeScreen } from "./welcome-screen.tsx"

type Phase = "loading" | "welcome" | "app"

export function ShellOverlays({ children }: { children: ReactNode }) {
  const { data } = authClient.useSession()
  const [phase, setPhase] = useState<Phase>("loading")
  const [expired, setExpired] = useState<{
    open: boolean
    email: string | null
  }>({
    open: false,
    email: null,
  })
  const finishWelcome = useCallback(() => setPhase("app"), [])

  useEffect(() => {
    const email = data?.user.email
    if (email) sessionStorage.setItem(SIGNED_OUT_EMAIL_KEY, email)
  }, [data?.user.email])

  useEffect(() => {
    setSessionExpiredListener((email) => {
      setExpired({ open: true, email })
    })
    return () => setSessionExpiredListener(null)
  }, [])

  useEffect(() => {
    let cancelled = false
    void apiFetch<{ ok: true; data: { welcomedAt?: string | null } }>(
      "/api/profile"
    )
      .then((body) => {
        if (cancelled) return
        setPhase(body.data.welcomedAt === null ? "welcome" : "app")
      })
      .catch(() => {
        if (!cancelled) setPhase("app")
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <>
      {phase === "welcome" ? (
        <WelcomeScreen onDone={finishWelcome} />
      ) : phase === "app" ? (
        children
      ) : null}
      <SessionExpiredDialog open={expired.open} email={expired.email} />
    </>
  )
}
