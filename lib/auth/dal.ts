import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import type { Account } from "./accounts";
import { SESSION_COOKIE, readToken } from "./cookie";
import { SIGN_IN_PATH, safeNext } from "./gate";
import { readSession } from "./sessions";

/**
 * The only way server code asks who is signed in.
 *
 * ## Why this exists when `proxy.ts` already checks
 *
 * The proxy checks a signature. A signature proves the cookie came from us, not
 * that the session behind it is alive: a cookie from a session that was signed
 * out an hour ago still carries a perfect signature. It is a filter, and the
 * Next documentation is explicit that it should not be the only one, because
 * the proxy runs on prefetches and a database call there is paid on requests
 * nobody made.
 *
 * So the real check lives here, next to the data, and it is the check every
 * page and every route runs. The rule that keeps this honest: nothing reads a
 * per-account row without calling one of these two functions first.
 *
 * ## Why `cache`
 *
 * A page, its layout and three of its components may each want to know who is
 * signed in. React's `cache` makes that one query per render pass instead of
 * five, without anyone having to thread the account down through props.
 */

export const currentAccount = cache(async (): Promise<Account | null> => {
  const jar = await cookies();
  const token = readToken(jar.get(SESSION_COOKIE)?.value);
  return readSession(token);
});

/**
 * The signed-in account, or a redirect to sign in.
 *
 * `next` carries where they were going, so signing in returns them to the
 * screen they asked for rather than dropping them somewhere generic. It is
 * passed through `safeNext`, which refuses anything that is not a path on this
 * site: without that check the parameter would turn the sign-in page into an
 * open redirect.
 */
export async function requireAccount(from?: string): Promise<Account> {
  const account = await currentAccount();
  if (account) return account;

  const next = safeNext(from);
  redirect(next ? `${SIGN_IN_PATH}?next=${encodeURIComponent(next)}` : SIGN_IN_PATH);
}
