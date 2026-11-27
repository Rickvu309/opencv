import { afterEach, describe, expect, it, vi } from "vitest"

import { authClient } from "@/lib/auth-client.ts"
import { loadedSessionCheck } from "@/lib/session-check.ts"
import {
  TEST_SESSION,
  TEST_SESSION_USER,
  setMockSessionAtom,
} from "@/test/auth-client-mock.ts"

const session = { user: TEST_SESSION_USER, session: TEST_SESSION }

function countSessionRequests() {
  return vi.spyOn(authClient, "getSession")
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe("loadedSessionCheck", () => {
  it("reuses the session the auth client loaded and asks the server zero times", async () => {
    const requests = countSessionRequests()
    setMockSessionAtom({ data: session, error: null, isPending: false })

    await expect(loadedSessionCheck()).resolves.toEqual({
      kind: "signed-in",
      session,
    })
    expect(requests).toHaveBeenCalledTimes(0)
  })

  it("waits for the loading session and still asks the server zero times", async () => {
    const requests = countSessionRequests()
    setMockSessionAtom({ data: null, error: null, isPending: true })

    const check = loadedSessionCheck()
    setMockSessionAtom({ data: null, error: null, isPending: false })

    await expect(check).resolves.toEqual({ kind: "signed-out" })
    expect(requests).toHaveBeenCalledTimes(0)
  })

  it("asks the server once when the loaded session has no answer", async () => {
    const requests = countSessionRequests()
    setMockSessionAtom({ data: null, error: { status: 503 }, isPending: false })

    await expect(loadedSessionCheck()).resolves.toMatchObject({
      kind: "signed-in",
    })
    expect(requests).toHaveBeenCalledTimes(1)
  })
})
