import { AccountError, createAccount } from "@/lib/auth/accounts";
import { callerKey, failure, readBody, tooManyAttempts, withSession } from "@/lib/auth/http";
import { startSession } from "@/lib/auth/sessions";
import { getPool } from "@/lib/db/client";
import { isLocale } from "@/lib/i18n/locale";
import { createAccountState } from "@/lib/state/account-state";

/**
 * Create an account, give it somewhere to keep its work, and sign in with it.
 *
 * All three in one transaction, because every pair of them has a bad middle:
 * an account with no state row, a state row belonging to nobody, or an account
 * created and not signed into. Either the person has an account they are
 * signed into with a place to work, or nothing happened at all.
 *
 * `locale` is what the browser is currently reading. It seeds the plan stage
 * labels, which become the user's text from that moment, so guessing it here
 * and letting them change it is better than defaulting everyone to Vietnamese
 * and making half of them fix it.
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

  const client = await getPool().connect();
  try {
    await client.query("begin");
    const account = await createAccount(body.username, body.password, client);
    // AC-ACCT-001.5: the state is associated with the account at the instant
    // the account exists, not on its first write.
    await createAccountState(
      account.id,
      isLocale(body.locale) ? body.locale : undefined,
      client,
    );
    const session = await startSession(account.id, client);
    await client.query("commit");

    return withSession({ username: account.username }, session);
  } catch (error) {
    await client.query("rollback").catch(() => {});

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
  } finally {
    client.release();
  }
}
