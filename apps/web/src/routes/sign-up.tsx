import { AuthScreen } from "@/features/auth/auth-screen.tsx"
import { SignUpForm } from "@/features/auth/sign-up-form.tsx"

export function SignUpPage() {
  return (
    <AuthScreen
      title="Start here"
      body="Your work stays yours — Threads, Paper, and Apply on this account."
    >
      <SignUpForm />
    </AuthScreen>
  )
}
