import type { authClient } from "@/lib/auth-client.ts"

export type KnownSession = typeof authClient.$Infer.Session

let known: KnownSession | null = null

export function rememberSession(session: KnownSession) {
  known = session
}

export function forgetSession() {
  known = null
}

export function knownSession() {
  return known
}
