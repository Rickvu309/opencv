import { useState, type FormEvent } from "react"
import { Link, useNavigate, useRouterState } from "@tanstack/react-router"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"

import { ErrorBanner } from "@/components/error-banner.tsx"
import { authClient } from "@/lib/auth-client.ts"
import { redirectFromSearch } from "@/lib/auth-redirect.ts"

export function SignUpForm() {
  const navigate = useNavigate()
  const redirectTo = useRouterState({
    select: (state) => redirectFromSearch(state.location.search),
  })
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setPending(true)

    const { error: signUpError } = await authClient.signUp.email({
      name: name.trim(),
      email: email.trim(),
      password,
    })

    setPending(false)

    if (signUpError) {
      setError(
        signUpError.message || "Could not create the account. Try again."
      )
      return
    }

    await navigate({ href: "/app" })
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="space-y-1.5">
        <label htmlFor="sign-up-name" className="text-sm font-medium">
          Name
        </label>
        <Input
          id="sign-up-name"
          type="text"
          name="name"
          autoComplete="name"
          required
          value={name}
          onChange={(event) => setName(event.currentTarget.value)}
        />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="sign-up-email" className="text-sm font-medium">
          Email
        </label>
        <Input
          id="sign-up-email"
          type="email"
          name="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.currentTarget.value)}
        />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="sign-up-password" className="text-sm font-medium">
          Password
        </label>
        <Input
          id="sign-up-password"
          type="password"
          name="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={password}
          onChange={(event) => setPassword(event.currentTarget.value)}
        />
      </div>
      {error ? <ErrorBanner variant="inline">{error}</ErrorBanner> : null}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Creating account…" : "Create account"}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link
          to="/sign-in"
          search={redirectTo ? { redirect: redirectTo } : undefined}
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          Sign in
        </Link>
      </p>
    </form>
  )
}
