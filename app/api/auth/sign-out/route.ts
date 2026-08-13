import { NextResponse } from "next/server";

import { SESSION_COOKIE, readToken } from "@/lib/auth/cookie";
import { endSession } from "@/lib/auth/sessions";

/**
 * End the session.
 *
 * The row is deleted first and the cookie cleared second, and the order is the
 * point: a cleared cookie with a live row is a door still open to any copy of
 * that cookie, which is the thing AC-ACCT-003.2 exists to prevent.
 *
 * Answers success in every case, including no session at all. Signing out is
 * something people do twice with a back button, and there is nothing to report
 * about a door that was already shut.
 */
export async function POST(request: Request) {
  const cookie = request.headers
    .get("cookie")
    ?.split("; ")
    .find((pair) => pair.startsWith(`${SESSION_COOKIE}=`))
    ?.slice(SESSION_COOKIE.length + 1);

  try {
    await endSession(readToken(cookie));
  } catch (error) {
    // The cookie is cleared below whatever happened here. A sign-out that
    // half worked must not leave the browser believing it is still signed in.
    console.error("auth: sign-out could not delete the session row", error);
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.delete(SESSION_COOKIE);
  return response;
}
