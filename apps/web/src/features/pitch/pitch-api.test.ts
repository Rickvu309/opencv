import { PITCH_COMMANDS, type PitchDoc } from "@workspace/domain"
import { describe, expect, it, vi } from "vitest"

import { apiBaseUrl } from "@/lib/api-url.ts"

import { getPitch, updatePitch } from "./pitch-api.ts"

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
