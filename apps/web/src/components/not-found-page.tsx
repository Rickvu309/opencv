import { useQuery } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"

import { getShellProfile } from "@/features/app-shell/shell-api.ts"
import { startPagePath } from "@/features/app-shell/start-page.ts"
import { authClient } from "@/lib/auth-client.ts"
import { Button } from "@workspace/ui/components/button"

const copy = {
  title: "Page not found",
  body: "This page does not exist.",
  start: "Back to start",
  signIn: "Go to sign in",
} as const

export function NotFoundPage() {
  const navigate = useNavigate()
  const session = authClient.useSession()
  const signedIn = Boolean(session.data)
  const profile = useQuery({
    queryKey: ["shell", "profile"],
    enabled: signedIn,
    queryFn: async () => {
      try {
        return await getShellProfile()
      } catch {
        return null
      }
    },
  })
  const label = signedIn ? copy.start : copy.signIn
  const destination = signedIn
    ? startPagePath(profile.data?.startPage)
    : "/sign-in"

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-background px-6">
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
    </main>
  )
}
