import { AuthForm } from "@/components/auth/auth-form";

/**
 * The one door a stranger may walk through, alongside the landing page.
 * AC-ACCT-005.2 names both.
 *
 * A new account lands on onboarding rather than on the Coach: the state it
 * starts from is deliberately empty, and the first useful thing to do with an
 * empty profile is fill it in.
 */
export default function SignUpPage() {
  return <AuthForm mode="sign-up" />;
}
