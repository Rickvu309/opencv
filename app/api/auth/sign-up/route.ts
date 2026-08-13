import { AccountError, createAccount } from "@/lib/auth/accounts";
import { callerKey, failure, readBody, tooManyAttempts, withSession } from "@/lib/auth/http";
import { startSession } from "@/lib/auth/sessions";

/**
 * Create an account and sign in with it, in one request.
 *
 * One request rather than two because there is no state in which the account
 * exists and the person is not signed into it. Splitting them would invent one,
 * and its failure mode is somebody's account created and unreachable.
 */
export async function POST(request: Request) {
  if (!process.env.DATABASE_URL) {
    console.error("auth: DATABASE_URL is not set");
    return failure("store-down", 503);
  }

  const body = await readBody(request);
  if (!body) return failure("bad-request", 400);

  if (tooManyAttempts(`sign-up:${callerKey(request)}`)) {
    return failure("rate-limited", 429);
  }

  try {
    const account = await createAccount(body.username, body.password);
    const session = await startSession(account.id);
    return withSession({ username: account.username }, session);
  } catch (error) {
    if (error instanceof AccountError) {
      // Every one of these is the person's to fix, so 400 rather than 409:
      // the client shows the message beside the field either way, and one
      // status for "you can correct this" keeps the client's branch simple.
      return failure(error.code, 400);
    }
    // Never report an account created when it was not. Logged without the
    // username: a failed write is an operational problem, not a reason to put
    // somebody's chosen name in a log line.
    console.error("auth: sign-up failed", error);
    return failure("store-down", 502);
  }
}
