import { PITCH_COMMANDS, type PitchDoc, type PublicPitch } from "@workspace/domain"
import { describe, expect, it, vi } from "vitest"

import { apiBaseUrl } from "@/lib/api-url.ts"

import { getPitch, getPublicPitch, updatePitch } from "./pitch-api.ts"

function envelope<T>(data: T) {
  return Response.json({ ok: true, data })
}

const doc: PitchDoc = {
  id: "11111111-1111-4111-8111-111111111111",
  kind: "pitch",
  content: { headline: "Test" },
  contentVersion: 1,
  createdAt: "2026-08-25T00:00:00.000Z",
  updatedAt: "2026-08-25T00:00:00.000Z",
}

describe("pitch API client", () => {
  it("reads Pitch from GET /api/pitch", async () => {
    const fetchMock = vi.fn().mockResolvedValue(envelope(doc))
    vi.stubGlobal("fetch", fetchMock)

    await expect(getPitch()).resolves.toEqual(doc)
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(`${apiBaseUrl}/api/pitch`)
  })

  it("reads a published Pitch from GET /api/pitch/public/:slug", async () => {
    const page: PublicPitch = {
      slug: "alex-tran",
      author: { name: "Alex Tran", email: "you@opencv.me", image: null },
      kind: "pitch",
      content: { published: true },
      contentVersion: 1,
    }
    const fetchMock = vi.fn().mockResolvedValue(envelope(page))
    vi.stubGlobal("fetch", fetchMock)

    await expect(getPublicPitch("alex-tran")).resolves.toEqual(page)
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(
      `${apiBaseUrl}/api/pitch/public/alex-tran`
    )
  })

  it("updates through the Command registry", async () => {
    const fetchMock = vi.fn().mockResolvedValue(envelope(doc))
    vi.stubGlobal("fetch", fetchMock)

    await updatePitch({
      content: doc.content as never,
      contentVersion: 1,
    })
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(
      `${apiBaseUrl}/api/commands/${PITCH_COMMANDS.update}`
    )
  })
})
