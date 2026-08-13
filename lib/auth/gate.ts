/**
 * Which paths need a session, and where someone without one is sent.
 *
 * ## Why this is a pure function and `proxy.ts` is four lines
 *
 * The rule "everything is closed except this list" is the kind of thing that is
 * either exactly right or quietly catastrophic, and the catastrophic version
 * looks identical until somebody reads a URL nobody thought to try. Written as
 * a function of a string it can be asked a hundred questions in a test file.
 * Written inside a Next proxy it can only be asked by running the app.
 *
 * ## Why the list is of open paths, not closed ones
 *
 * The two spellings are not equally safe. A list of closed paths forgets the
 * screen added next month, and forgetting means the screen is public. A list of
 * open paths forgets the same screen and the failure is a redirect to sign-in,
 * which somebody notices in a minute and nobody is harmed by.
 */

export type GateDecision =
  | { allow: true }
  | { allow: false; redirectTo: string };

/** Where somebody without a session is sent. */
export const SIGN_IN_PATH = "/sign-in";

/**
 * Open to anyone, exactly as AC-ACCT-005.2 requires, plus the machinery a
 * visitor needs before they have an account.
 */
const PUBLIC_PATHS = new Set([
  "/", // the landing page
  "/sign-in",
  "/sign-up",
]);

/**
 * Open prefixes.
 *
 * - `/api/auth/` is how a session is obtained; requiring one would be a loop.
 * - `/api/waitlist` is the one input taken from a stranger.
 * - `/eve/` and `/.well-known/workflow/` are the Coach transport. The agent
 *   does its own authentication and WO-26 changes what that means; gating them
 *   here would break the stream without adding a check the agent lacks.
 * - `/_next/` and the rest are the framework's own files.
 */
const PUBLIC_PREFIXES = [
  "/api/auth/",
  "/api/waitlist",
  "/eve/",
  "/.well-known/",
  "/_next/",
];

/** Files, not screens. A dot in the last segment is a good enough test. */
function isAsset(pathname: string): boolean {
  const last = pathname.slice(pathname.lastIndexOf("/") + 1);
  return last.includes(".");
}

/**
 * Where to send someone back to after they sign in.
 *
 * Only a path from this site, and only one that starts with a single slash. An
 * absolute URL here would turn the sign-in page into an open redirect: a link
 * to `/sign-in?next=https://not-us.example` that lands somebody on a copy of
 * this product asking for their password. `//host` is the same attack with a
 * shorter spelling, which is why the second character is checked too.
 */
export function safeNext(target: string | null | undefined): string | null {
  if (!target) return null;
  if (!target.startsWith("/") || target.startsWith("//")) return null;
  if (target === SIGN_IN_PATH) return null;
  return target;
}

/**
 * May this request through?
 *
 * `hasSession` is the cheap answer: a cookie carrying our signature. It is not
 * proof of a live session, and it is not meant to be. The database has the
 * truth and is asked by the data access layer, next to the data. This decides
 * only whether to bother rendering.
 */
export function gateFor(pathname: string, hasSession: boolean): GateDecision {
  if (hasSession) return { allow: true };

  if (PUBLIC_PATHS.has(pathname)) return { allow: true };
  if (PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return { allow: true };
  }
  if (isAsset(pathname)) return { allow: true };

  const next = safeNext(pathname);
  return {
    allow: false,
    redirectTo: next ? `${SIGN_IN_PATH}?next=${encodeURIComponent(next)}` : SIGN_IN_PATH,
  };
}
