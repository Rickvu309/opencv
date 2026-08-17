import { getCookie } from "@tanstack/react-start/server";

import type { Account } from "./accounts";
import { SESSION_COOKIE, readToken } from "./cookie";
import { readSession } from "./sessions";

/**
 * The only way server code asks who is signed in.
 *
 * ## Why this exists when the request middleware already checks
 *
 * The gate checks a signature. A signature proves the cookie came from us, not
 * that the session behind it is alive: a cookie from a session that was signed
 * out an hour ago still carries a perfect signature. It is a filter, and it
 * should not be the only one, because the gate runs on every request including
 * prefetches, and a database call there is paid on requests nobody made.
 *
 * So the real check lives here, next to the data. The rule that keeps this
 * honest: nothing reads a per-account row without calling this first. Screens
 * without a session are redirected by the gate; endpoints that need an account
 * call this and answer 401 when it is null.
 */

export async function currentAccount(): Promise<Account | null> {
  const token = readToken(getCookie(SESSION_COOKIE));
  return readSession(token);
}
