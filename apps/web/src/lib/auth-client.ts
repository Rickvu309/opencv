import { emailOTPClient } from "better-auth/client/plugins"
import { createAuthClient } from "better-auth/react"

import { apiBaseUrl } from "@/lib/api-url.ts"

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
