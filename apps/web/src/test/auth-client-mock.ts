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

export function setMockSession(data: MockSession | null) {
  authMockState.data = data
}

function installAuthMocks() {
  authClient.signIn.email.mockImplementation(async () => {
    authMockState.data = signedInSession()
    return { data: authMockState.data, error: null }
  })
  authClient.signUp.email.mockImplementation(
    async (input: { name: string; email: string; password: string }) => {
      authMockState.data = signedInSession({
        name: input.name,
        email: input.email,
      })
      return { data: authMockState.data, error: null }
    }
  )
  authClient.signOut.mockImplementation(async () => {
    authMockState.data = null
    return { data: { success: true }, error: null }
  })
}

export function resetMockSession() {
  authMockState.data = signedInSession()
  authClient.signIn.email.mockReset()
  authClient.signUp.email.mockReset()
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
  signIn: {
    email: vi.fn(),
  },
  signUp: {
    email: vi.fn(),
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
