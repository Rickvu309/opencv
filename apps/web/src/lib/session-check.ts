import { authClient } from "@/lib/auth-client.ts"
import {
  forgetSession,
  knownSession,
  rememberSession,
  type KnownSession,
} from "@/lib/known-session.ts"

export type SessionCheck =
  | { kind: "signed-in"; session: KnownSession }
  | { kind: "signed-out" }
  | { kind: "unknown"; lastKnown: KnownSession | null }

export type SessionReply = {
  data: unknown
  error: { status?: number } | null
}

const SERVER_SAYS_NO_SESSION_STATUSES: ReadonlySet<number> = new Set([401])

export const SESSION_RETRY_DELAYS_MS = [200, 600] as const

export class SessionCheckUnknown extends Error {
  constructor() {
    super("The session check did not get an answer from the server")
    this.name = "SessionCheckUnknown"
  }
}

function isSession(value: unknown): value is KnownSession {
  return (
    typeof value === "object" &&
    value !== null &&
    "user" in value &&
    "session" in value
  )
}

export function parseSessionReply(
  reply: SessionReply,
  lastKnown: KnownSession | null
): SessionCheck {
  if (reply.error) {
    const status = reply.error.status
    if (status !== undefined && SERVER_SAYS_NO_SESSION_STATUSES.has(status))
      return { kind: "signed-out" }
    return { kind: "unknown", lastKnown }
  }
  if (reply.data === null) return { kind: "signed-out" }
  if (isSession(reply.data)) return { kind: "signed-in", session: reply.data }
  return { kind: "unknown", lastKnown }
}

async function askOnce(): Promise<SessionCheck> {
  try {
    return parseSessionReply(await authClient.getSession(), knownSession())
  } catch {
    return { kind: "unknown", lastKnown: knownSession() }
  }
}

function waitFor(ms: number) {
  return new Promise<void>((resolve) => {
    const timer = window.setTimeout(() => {
      window.clearTimeout(timer)
      resolve()
    }, ms)
  })
}

export async function checkSession(): Promise<SessionCheck> {
  let check = await askOnce()
  for (const delay of SESSION_RETRY_DELAYS_MS) {
    if (check.kind !== "unknown") break
    await waitFor(delay)
    check = await askOnce()
  }
  if (check.kind === "signed-in") rememberSession(check.session)
  if (check.kind === "signed-out") forgetSession()
  return check
}

type SessionAtomValue = SessionReply & { isPending: boolean }

type SessionAtom = {
  get(): SessionAtomValue
  listen(listener: (value: SessionAtomValue) => void): () => void
}

function loadedSessionReply(): Promise<SessionReply> {
  const atom: SessionAtom = authClient.$store.atoms.session
  const now = atom.get()
  if (!now.isPending) return Promise.resolve(now)
  return new Promise((resolve) => {
    const stop = atom.listen((value) => {
      if (value.isPending) return
      stop()
      resolve(value)
    })
  })
}

export async function loadedSessionCheck(): Promise<SessionCheck> {
  const check = parseSessionReply(await loadedSessionReply(), knownSession())
  if (check.kind === "unknown") return checkSession()
  if (check.kind === "signed-in") rememberSession(check.session)
  return check
}

export function sessionToKeep(check: SessionCheck): KnownSession | null {
  if (check.kind === "signed-in") return check.session
  if (check.kind === "unknown") return check.lastKnown
  return null
}
