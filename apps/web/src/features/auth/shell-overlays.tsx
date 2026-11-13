import { useCallback, useEffect, useReducer, type ReactNode } from "react"
import { useQueryClient } from "@tanstack/react-query"

import { profileQuery } from "@/lib/account-api.ts"
import { setSessionExpiredListener } from "@/lib/api.ts"
import { authClient } from "@/lib/auth-client.ts"
import { SIGNED_OUT_EMAIL_KEY } from "@/lib/auth-redirect.ts"
import { SessionExpiredDialog } from "./session-expired-dialog.tsx"
import { WelcomeScreen } from "./welcome-screen.tsx"

type Phase = "loading" | "welcome" | "app"

type Overlays = {
  phase: Phase
  expired: { open: boolean; email: string | null }
}
type OverlayAction =
  | { type: "loaded"; welcomed: boolean }
  | { type: "load_failed" }
  | { type: "welcome_finished" }
  | { type: "session_expired"; email: string | null }

function overlayReducer(state: Overlays, action: OverlayAction): Overlays {
  switch (action.type) {
    case "loaded":
      return { ...state, phase: action.welcomed ? "app" : "welcome" }
    case "load_failed":
    case "welcome_finished":
      return { ...state, phase: "app" }
    case "session_expired":
      return { ...state, expired: { open: true, email: action.email } }
  }
}

export function ShellOverlays({ children }: { children: ReactNode }) {
  const { data } = authClient.useSession()
  const queryClient = useQueryClient()
  const [{ phase, expired }, dispatch] = useReducer(overlayReducer, {
    phase: "loading",
    expired: { open: false, email: null },
  })
  const finishWelcome = useCallback(
    () => dispatch({ type: "welcome_finished" }),
    []
  )

  useEffect(() => {
    const email = data?.user.email
    if (email) sessionStorage.setItem(SIGNED_OUT_EMAIL_KEY, email)
  }, [data?.user.email])

  useEffect(() => {
    setSessionExpiredListener((email) => {
      dispatch({ type: "session_expired", email })
    })
    return () => setSessionExpiredListener(null)
  }, [])

  useEffect(() => {
    let cancelled = false
    void queryClient
      .fetchQuery(profileQuery())
      .then((profile) => {
        if (cancelled) return
        dispatch({
          type: "loaded",
          welcomed: profile.welcomedAt !== null,
        })
      })
      .catch(() => {
        if (!cancelled) dispatch({ type: "load_failed" })
      })
    return () => {
      cancelled = true
    }
  }, [queryClient])

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
