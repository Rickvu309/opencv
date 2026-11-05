import { emailOTPClient } from "better-auth/client/plugins"
import { createAuthClient } from "better-auth/react"

import { apiBaseUrl } from "@/lib/api-url.ts"

export const SEND_SESSION_COOKIE_TO_API_ORIGIN = {
  credentials: "include",
} as const satisfies RequestInit

export const authClient = createAuthClient({
  baseURL: apiBaseUrl,
  basePath: "/api/auth",
  fetchOptions: SEND_SESSION_COOKIE_TO_API_ORIGIN,
  plugins: [emailOTPClient()],
})

export function invalidateClientSession() {
  authClient.$store.notify("$sessionSignal")
}
