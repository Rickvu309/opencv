import { afterEach, expect, it, vi } from "vitest"
import { continueAuthorization } from "./connections-api.ts"

afterEach(() => vi.unstubAllGlobals())

it("resumes the signed-out authorization with the provider post-login discriminator", async () => {
  const request = vi.fn(async () =>
    Response.json({ url: "https://opencv.test/oauth/consent" })
  )
  vi.stubGlobal("fetch", request)
  await continueAuthorization("client_id=agent&sig=signed")
  expect(request).toHaveBeenCalledWith(
    expect.objectContaining({ pathname: "/api/auth/oauth2/continue" }),
    expect.objectContaining({
      method: "POST",
      body: JSON.stringify({
        oauth_query: "client_id=agent&sig=signed",
        postLogin: true,
      }),
    })
  )
})
