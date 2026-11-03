import { afterEach, describe, expect, it, vi } from "vitest"

type RealAuthClient = typeof import("./auth-client.ts")

function sentCredentials(call: unknown[]) {
  const [input, init] = call as [RequestInfo | URL, RequestInit | undefined]
  return (
    init?.credentials ??
    (input instanceof Request ? input.credentials : undefined)
  )
}

describe("authClient", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("names credentials include as the cookie rule for the api origin", async () => {
    const real = await vi.importActual<RealAuthClient>("./auth-client.ts")

    expect(real.SEND_SESSION_COOKIE_TO_API_ORIGIN).toEqual({
      credentials: "include",
    })
  })

  it("sends the session cookie to the api origin on a session read", async () => {
    const fetchStub = vi.fn(
      async () =>
        new Response("null", {
          status: 200,
          headers: { "content-type": "application/json" },
        })
    )
    vi.stubGlobal("fetch", fetchStub)
    vi.resetModules()
    const { authClient } =
      await vi.importActual<RealAuthClient>("./auth-client.ts")

    await authClient.getSession()

    expect(fetchStub).toHaveBeenCalled()
    for (const call of fetchStub.mock.calls) {
      expect(sentCredentials(call)).toBe("include")
    }
  })
})
