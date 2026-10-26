import { vi } from "vitest"

import { SAMPLE_AUTHOR } from "@/features/seed/sample-author.ts"

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

export const authMockState: { data: MockSession | null } = {
  data: signedInSession(),
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

export function resetMockSession() {
  authMockState.data = signedInSession()
  mockPublicConfig.google = false
  authClient.emailOtp.sendVerificationOtp.mockReset()
  authClient.signIn.emailOtp.mockReset()
  authClient.signIn.social.mockReset()
  authClient.signOut.mockReset()
  authClient.$store.notify.mockReset()
  installAuthMocks()
}

export function invalidateClientSession() {
  authMockState.data = null
  authClient.$store.notify("$sessionSignal")
}

export const authClient = {
  getSession: async () => ({ data: authMockState.data, error: null }),
  useSession: () => ({
    data: authMockState.data,
    isPending: false,
    isRefetching: false,
    error: null,
    refetch: async () => {},
  }),
  emailOtp: {
    sendVerificationOtp: vi.fn(),
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
    atoms: {},
  },
}

installAuthMocks()
