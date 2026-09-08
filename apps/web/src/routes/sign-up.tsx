import { AuthScreen } from "@/features/auth/auth-screen.tsx"
import { SIGN_UP_COPY } from "@/features/auth/sign-up-copy.ts"
import { SignUpForm } from "@/features/auth/sign-up-form.tsx"

export function SignUpPage() {
  return (
    <AuthScreen title={SIGN_UP_COPY.title} body={SIGN_UP_COPY.body}>
      <SignUpForm />
    </AuthScreen>
  )
}
