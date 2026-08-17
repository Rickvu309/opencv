import { AccountError, verifyCredentials } from "@/lib/auth/accounts";
import { callerKey, failure, readBody, tooManyAttempts, withSession } from "@/lib/auth/http";
import { startSession } from "@/lib/auth/sessions";
import { needsOnboarding } from "@/lib/onboarding/complete";
import { loadAccountState } from "@/lib/state/account-state.server";

/**
 * Sign in to an existing account.
 *
 * Every rejection answers `bad-credentials` with the same status, whether the
 * email is unknown, the password is wrong, or a field was left empty. Saying
 * which would tell anyone with a form which emails exist, and that is most
 * of the work of breaking into one. AC-ACCT-002.2.
 */
export async function POST(request: Request) {
  if (!process.env.DATABASE_URL) {
    console.error("auth: DATABASE_URL is not set");
    return failure("store-down", 503);
  }

  const body = await readBody(request);
  if (!body) return failure("bad-request", 400);

  if (tooManyAttempts(`sign-in:${callerKey(request)}`)) {
    return failure("rate-limited", 429);
  }

  try {
    const account = await verifyCredentials(body.email, body.password);
    const session = await startSession(
      account.id,
      undefined,
      undefined,
      body.rememberMe === true,
    );
    const state = await loadAccountState(account.id);
    return withSession(
      { username: account.username, needsOnboarding: needsOnboarding(state) },
      session,
    );
  } catch (error) {
    if (error instanceof AccountError) return failure(error.code, 401);
    console.error("auth: sign-in failed", error);
    return failure("store-down", 502);
  }
}
