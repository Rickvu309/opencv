import { emailOTPClient } from "better-auth/client/plugins"
import { createAuthClient } from "better-auth/react"

import {
  disposeCoachStops,
  setCoachStopSession,
} from "@/lib/coach-stop-registry.ts"
import { apiBaseUrl } from "@/lib/api-url.ts"

export const SEND_SESSION_COOKIE_TO_API_ORIGIN = {
  credentials: "include",
} as const satisfies RequestInit

export const authClient = createAuthClient({
  baseURL: apiBaseUrl,
  basePath: "/api/auth",
  fetchOptions: {
    ...SEND_SESSION_COOKIE_TO_API_ORIGIN,
    onRequest(context) {
      if (new URL(context.url).pathname === "/api/auth/sign-out")
        disposeCoachStops()
    },
  },
  plugins: [emailOTPClient()],
})

authClient.$store.atoms.session.subscribe((session) => {
  if (!session.isPending) setCoachStopSession(session.data?.session.id ?? null)
})

export function invalidateClientSession() {
  disposeCoachStops()
  authClient.$store.notify("$sessionSignal")
}
