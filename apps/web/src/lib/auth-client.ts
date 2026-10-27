import { emailOTPClient } from "better-auth/client/plugins"
import { createAuthClient } from "better-auth/react"

import { apiBaseUrl } from "@/lib/api-url.ts"

/**
 * Better Auth React client. `baseURL` is the Railway API (auth lives at
 * `/api/auth/*`). The client already sends `credentials: "include"` so the
 * cross-origin session cookie (opencv.me → api.opencv.me) is included.
 */
export const authClient = createAuthClient({
  baseURL: apiBaseUrl,
  basePath: "/api/auth",
  plugins: [emailOTPClient()],
})

export type SessionUser = {
  id: string
  name: string
  email: string
  image?: string | null
}

export function invalidateClientSession() {
  authClient.$store.notify("$sessionSignal")
}
