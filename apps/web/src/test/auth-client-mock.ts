import { vi } from "vitest"

import { SAMPLE_AUTHOR } from "@/features/seed/sample-author.ts"
import { forgetSession } from "@/lib/known-session.ts"

export const TEST_SESSION_USER = {
  id: "user_test",
  name: SAMPLE_AUTHOR.name,
  email: SAMPLE_AUTHOR.email,
  emailVerified: false,
  image: null as string | null,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
}

export const TEST_SESSION = {
  id: "session_test",
  token: "test-session-token",
  userId: TEST_SESSION_USER.id,
  expiresAt: new Date("2027-01-01T00:00:00.000Z"),
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
}

export type MockSession = {
  user: typeof TEST_SESSION_USER
  session: typeof TEST_SESSION
}

function signedInSession(
  user: Partial<typeof TEST_SESSION_USER> = {}
): MockSession {
  return {
    user: { ...TEST_SESSION_USER, ...user },
    session: { ...TEST_SESSION },
  }
}

export type MockSessionFailure = "rate-limited" | "server-error" | "network"

export const authMockState: {
  data: MockSession | null
  failure: MockSessionFailure | null
} = {
  data: signedInSession(),
  failure: null,
}

export function failMockSessionCheck(failure: MockSessionFailure | null) {
  authMockState.failure = failure
}

const FAILURE_STATUS = { "rate-limited": 429, "server-error": 503 } as const

async function mockGetSession() {
  const failure = authMockState.failure
  if (failure === "network") throw new TypeError("Failed to fetch")
  if (failure)
    return {
      data: null,
      error: { status: FAILURE_STATUS[failure], statusText: failure },
    }
  return { data: authMockState.data, error: null }
}

export const mockPublicConfig = { google: false }

export function setMockGoogle(google: boolean) {
  mockPublicConfig.google = google
}

export function setMockSession(data: MockSession | null) {
  authMockState.data = data
}

function installAuthMocks() {
  authClient.emailOtp.sendVerificationOtp.mockImplementation(async () => ({
    data: { success: true },
    error: null,
  }))
  authClient.emailOtp.changeEmail.mockImplementation(async () => ({
    data: { status: true },
    error: null,
  }))
  authClient.signIn.emailOtp.mockImplementation(async () => {
    authMockState.data = signedInSession()
    return {
      data: { token: "test-token", user: authMockState.data?.user },
      error: null,
    }
  })
  authClient.signIn.social.mockImplementation(async () => ({
    data: { redirect: true, url: "https://accounts.google.com" },
    error: null,
  }))
  authClient.signOut.mockImplementation(async () => {
    authMockState.data = null
    return { data: { success: true }, error: null }
  })
}

type MockSessionAtomValue = {
  data: MockSession | null
  error: { status?: number } | null
  isPending: boolean
}

const sessionAtomListeners = new Set<(value: MockSessionAtomValue) => void>()
let sessionAtomValue: MockSessionAtomValue = {
  data: authMockState.data,
  error: null,
  isPending: false,
}

export function setMockSessionAtom(value: MockSessionAtomValue) {
  sessionAtomValue = value
  for (const listener of [...sessionAtomListeners]) listener(value)
}

const sessionAtom = {
  get: () => sessionAtomValue,
  listen: (listener: (value: MockSessionAtomValue) => void) => {
    sessionAtomListeners.add(listener)
    return () => {
      sessionAtomListeners.delete(listener)
    }
  },
}

export function resetMockSession() {
  sessionAtomListeners.clear()
  sessionAtomValue = { data: signedInSession(), error: null, isPending: false }
  authMockState.data = signedInSession()
  authMockState.failure = null
  forgetSession()
  mockPublicConfig.google = false
  authClient.emailOtp.sendVerificationOtp.mockReset()
  authClient.emailOtp.changeEmail.mockReset()
  authClient.signIn.emailOtp.mockReset()
  authClient.signIn.social.mockReset()
  authClient.signOut.mockReset()
  authClient.$store.notify.mockReset()
  installAuthMocks()
}

export function invalidateClientSession() {
  authMockState.data = null
  forgetSession()
  authClient.$store.notify("$sessionSignal")
}

export const authClient = {
  getSession: mockGetSession,
  useSession: () => ({
    data: authMockState.data,
    isPending: false,
    isRefetching: false,
    error: null,
    refetch: async () => {},
  }),
  emailOtp: {
    sendVerificationOtp: vi.fn(),
    changeEmail: vi.fn(),
  },
  signIn: {
    emailOtp: vi.fn(),
    social: vi.fn(),
  },
  signOut: vi.fn(),
  hydrateSession: (data: MockSession | null) => {
    authMockState.data = data
  },
  $store: {
    notify: vi.fn(),
    atoms: { session: sessionAtom },
  },
}

installAuthMocks()
