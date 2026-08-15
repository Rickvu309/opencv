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

/**
 * Three outcomes, not two.
 *
 * A screen and an endpoint are refused differently. Sending a browser to the
 * sign-in page is right for a screen and wrong for `fetch`, which follows the
 * redirect, receives a page of HTML and reports whatever that page's status
 * was. The caller then cannot tell "your session ended" from "the server is
 * broken", and the user is told the wrong thing about their own work.
 */
export type GateDecision =
  | { kind: "allow" }
  | { kind: "redirect"; to: string }
  | { kind: "unauthorized" };

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
  "/p/",
  "/u/",
  "/api/auth/",
  "/api/waitlist",
  // The scheduler's own door. Public to the gate because there is no session
  // behind a cron request; it authenticates itself with `CRON_SECRET` and
  // refuses when that is unset, which is a stronger check than this one.
  "/api/cron",
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
 *
 * `extraPublic` is for the local proxy: `next dev` can preview onboarding
 * without a session. Tests and production omit it, so the screen stays closed.
 */
export function gateFor(
  pathname: string,
  hasSession: boolean,
  extraPublic: readonly string[] = [],
): GateDecision {
  if (hasSession) return { kind: "allow" };

  if (PUBLIC_PATHS.has(pathname) || extraPublic.includes(pathname)) {
    return { kind: "allow" };
  }
  if (PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return { kind: "allow" };
  }
  if (isAsset(pathname)) return { kind: "allow" };

  // An endpoint is told, not redirected. Every one of them checks the session
  // itself before touching a row, so this is the answer arriving earlier and
  // in the right shape, never the only thing standing in the way.
  if (pathname.startsWith("/api/")) return { kind: "unauthorized" };

  const next = safeNext(pathname);
  return {
    kind: "redirect",
    to: next ? `${SIGN_IN_PATH}?next=${encodeURIComponent(next)}` : SIGN_IN_PATH,
  };
}
