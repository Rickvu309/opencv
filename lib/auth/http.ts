import { NextResponse } from "next/server";

import { SESSION_COOKIE, cookieOptions, signToken } from "./cookie";
import type { Session } from "./sessions";

/**
 * The shape the three auth routes share.
 *
 * They answer the way `app/api/waitlist/route.ts` answers: a stable `code`,
 * never a sentence. The server has no way to know whether this browser reads
 * Vietnamese or English, and a server that guesses gets it wrong for exactly
 * the people this product exists to reach. The client turns the code into a
 * `Msg` pair from `lib/i18n/messages.ts`.
 */

export function failure(code: string, status: number): NextResponse {
  return NextResponse.json({ ok: false, code }, { status });
}

/** The request's JSON body, or null when it is not JSON at all. */
export async function readBody(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body: unknown = await request.json();
    if (typeof body !== "object" || body === null) return null;
    return body as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * A success that also opens the door: the session cookie rides on the response.
 *
 * Set here rather than through `cookies()` so that issuing a session and
 * answering the request are one statement. Two statements is how a route ends
 * up returning success without a cookie.
 */
export function withSession(
  body: Record<string, unknown>,
  session: Session,
): NextResponse {
  const response = NextResponse.json({ ok: true, ...body });
  response.cookies.set(
    SESSION_COOKIE,
    signToken(session.token),
    cookieOptions(session.expiresAt),
  );
  return response;
}

/**
 * A crude brake on password guessing, and honest about what it is.
 *
 * Per-instance and lost on a cold start, exactly like the waiting list's, so it
 * is not a rate limit in any rigorous sense. What it stops is the obvious case:
 * one script working through a word list against one username. A real limit
 * needs shared state, and the session table is not the place to invent one.
 *
 * The alternative, which is nothing at all, leaves an unlimited password oracle
 * on a public URL. bcrypt makes each guess cost about 60ms, and 60ms times
 * forever is still forever.
 */
const MAX_ATTEMPTS = 10;
const WINDOW_MS = 60_000;
const attempts = new Map<string, { count: number; resetAt: number }>();

export function tooManyAttempts(key: string): boolean {
  const now = Date.now();
  const seen = attempts.get(key);
  if (!seen || now > seen.resetAt) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  seen.count += 1;
  return seen.count > MAX_ATTEMPTS;
}

/** Who is asking, as far as the platform will say. */
export function callerKey(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}
