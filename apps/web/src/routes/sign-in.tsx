import { AuthScreen } from "@/features/auth/auth-screen.tsx"
import { SignInForm } from "@/features/auth/sign-in-form.tsx"

export function SignInPage() {
  return (
    <AuthScreen title="Welcome back" body="Sign in to continue your work.">
      <SignInForm />
    </AuthScreen>
  )
}
