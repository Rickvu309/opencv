import { Suspense, createContext, lazy, useContext } from "react"
import { useQuery } from "@tanstack/react-query"
import { Outlet, useNavigate, useRouterState } from "@tanstack/react-router"

import { fetchProfile, profileKey } from "@/lib/account-api.ts"
import { startPagePath } from "@/features/app-shell/start-page.ts"
import { authClient } from "@/lib/auth-client.ts"
import { Button } from "@workspace/ui/components/button"

const AppShellLayout = lazy(() =>
  import("@/features/app-shell/app-shell-layout.tsx").then((module) => ({
    default: module.AppShellLayout,
  }))
)

const copy = {
  title: "Page not found",
  body: "This page does not exist.",
  start: "Back to start",
  signIn: "Go to sign in",
} as const

const InShell = createContext(false)

function matchSignedIn(state: {
  matches: ReadonlyArray<{ context: unknown }>
}) {
  return state.matches.some((match) => {
    const context = match.context
    if (typeof context !== "object" || context === null) return false
    if (!("signedIn" in context)) return false
    return Boolean((context as { signedIn?: boolean }).signedIn)
  })
}

export function UnknownShell() {
  const signedIn = useRouterState({ select: matchSignedIn })
  if (!signedIn) {
    return (
      <InShell.Provider value={false}>
        <Outlet />
      </InShell.Provider>
    )
  }
  return (
    <InShell.Provider value={true}>
      <Suspense fallback={null}>
        <AppShellLayout />
      </Suspense>
    </InShell.Provider>
  )
}

export function NotFoundPage() {
  const inShell = useContext(InShell)
  const navigate = useNavigate()
  const session = authClient.useSession()
  const signedIn = inShell || Boolean(session.data)
  const profile = useQuery({
    queryKey: profileKey(),
    enabled: signedIn,
    queryFn: fetchProfile,
  })
  const label = signedIn ? copy.start : copy.signIn
  const destination = signedIn
    ? startPagePath(profile.data?.startPage)
    : "/sign-in"
  const body = (
    <>
      <h1 className="text-3xl font-semibold tracking-tight text-foreground">
        {copy.title}
      </h1>
      <p className="mt-2 max-w-sm text-center text-sm text-muted-foreground">
        {copy.body}
      </p>
      <Button
        type="button"
        variant="glow"
        className="mt-6"
        onClick={() => void navigate({ href: destination })}
      >
        {label}
      </Button>
    </>
  )

  if (inShell) {
    return (
      <div
        role="region"
        aria-label={copy.title}
        className="flex h-full min-h-0 w-full flex-col items-center justify-center px-6"
      >
        {body}
      </div>
    )
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-background px-6">
      {body}
    </main>
  )
}
