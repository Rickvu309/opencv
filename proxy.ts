import { NextResponse, type NextRequest } from "next/server";

import { SESSION_COOKIE, readToken } from "@/lib/auth/cookie";
import { gateFor } from "@/lib/auth/gate";

/**
 * The front door. Runs before every request and decides whether to bother.
 *
 * Everything it knows is in `lib/auth/gate.ts`, which is where the rules are
 * tested. This file only translates a decision into a Next response, and it
 * stays this short on purpose: the Next docs are firm that the proxy runs on
 * prefetches too, so anything slow here is paid on requests the user never
 * made. There is no database call in this path. The real check happens in
 * `lib/auth/dal.ts`, next to the data it protects.
 *
 * Note for anyone arriving from an older Next: this file was `middleware.ts`
 * before Next 16 renamed it.
 */
export function proxy(request: NextRequest) {
  const cookie = request.cookies.get(SESSION_COOKIE)?.value;
  // A signature we did not write is the same as no cookie at all.
  const hasSession = readToken(cookie) !== null;

  const decision = gateFor(request.nextUrl.pathname, hasSession);
  if (decision.allow) return NextResponse.next();

  return NextResponse.redirect(new URL(decision.redirectTo, request.nextUrl));
}

export const config = {
  // Everything. The gate's own list decides what is open, and a matcher that
  // tried to say the same thing again would be a second place to forget.
  matcher: "/:path*",
};
