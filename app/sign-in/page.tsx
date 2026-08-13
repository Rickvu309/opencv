import { AuthForm } from "@/components/auth/auth-form";

/**
 * Where `proxy.ts` sends anyone without a session, carrying `next` so that
 * signing in returns them to the screen they actually asked for.
 *
 * The value is checked before it is used: `safeNext` in `lib/auth/gate.ts`
 * refuses anything that is not a path on this site, because an absolute URL
 * here would turn this page into an open redirect.
 */
export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return <AuthForm mode="sign-in" next={next} />;
}
