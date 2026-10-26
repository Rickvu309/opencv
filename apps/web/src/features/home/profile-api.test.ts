import { DEFAULT_COACH_MODE } from "@workspace/domain"
import { afterEach, describe, expect, it, vi } from "vitest"

import { apiBaseUrl } from "@/lib/api-url.ts"
import { getProfile, setCoachMode } from "@/features/home/profile-api.ts"

afterEach(() => {
  vi.unstubAllGlobals()
})

function envelope<T>(data: T) {
  return Response.json({ ok: true, data })
}

describe("profile API client", () => {
  it("loads the profile and round-trips Coach mode", async () => {
    const profile = {
      id: "user_1",
      name: "Minh",
      email: "minh@example.com",
      emailVerified: false,
      image: null,
      coachMode: DEFAULT_COACH_MODE,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    }
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(envelope(profile))
      .mockResolvedValueOnce(envelope({ ...profile, coachMode: "light" }))
    vi.stubGlobal("fetch", fetchMock)

    await expect(getProfile()).resolves.toEqual(profile)
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(
      `${apiBaseUrl}/api/profile`
    )

    await expect(setCoachMode("light")).resolves.toMatchObject({
      coachMode: "light",
    })
    expect(String(fetchMock.mock.calls[1]?.[0])).toBe(
      `${apiBaseUrl}/api/commands/profile.update`
    )
    const [, init] = fetchMock.mock.calls[1] as [string, RequestInit]
    expect(init.body).toBe(JSON.stringify({ coachMode: "light" }))
  })
})
