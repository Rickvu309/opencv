import {
  createCsrfMiddleware,
  createMiddleware,
  createStart,
} from "@tanstack/react-start";
import { getCookie } from "@tanstack/react-start/server";

import { SESSION_COOKIE, readToken } from "@/lib/auth/cookie";
import { gateFor } from "@/lib/auth/gate";

const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === "serverFn",
});

/**
 * The front door: Start request middleware calling `gateFor`.
 *
 * Same rules, same cheap cookie-signature check, no database. The live session
 * is still asked next to the data in `src/lib/auth/dal.ts`.
 */
const authGate = createMiddleware().server(async ({ next, request }) => {
  const pathname = new URL(request.url).pathname;
  const hasSession = readToken(getCookie(SESSION_COOKIE)) !== null;
  const extraPublic =
    process.env.NODE_ENV === "development" ? ["/onboarding"] : [];
  const decision = gateFor(pathname, hasSession, extraPublic);
  if (decision.kind === "allow") return next();
  if (decision.kind === "unauthorized") {
    return new Response(JSON.stringify({ ok: false, code: "no-session" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }
  return new Response(null, {
    status: 302,
    headers: { Location: decision.to },
  });
});

export const startInstance = createStart(() => ({
  requestMiddleware: [csrfMiddleware, authGate],
}));
