import { AuthScreen } from "@/features/auth/auth-screen.tsx"
import { SignUpForm } from "@/features/auth/sign-up-form.tsx"

export const SIGN_UP_COPY = {
  title: "Start here",
  body: "Your work stays yours — Paper, Apply, and Pitch on this account.",
} as const

export function SignUpPage() {
  return (
    <AuthScreen title={SIGN_UP_COPY.title} body={SIGN_UP_COPY.body}>
      <SignUpForm />
    </AuthScreen>
  )
}
