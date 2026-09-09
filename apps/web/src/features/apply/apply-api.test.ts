import { APPLY_COMMANDS, type ApplyCard } from "@workspace/domain"
import { describe, expect, it, vi } from "vitest"

import { apiBaseUrl } from "@/lib/api-url.ts"

import {
  createApplyCard,
  listApplyCards,
  moveApplyCard,
  optimisticMoveCard,
  scanApplyJob,
} from "./apply-api.ts"

function envelope<T>(data: T) {
  return Response.json({ ok: true, data })
}

const card: ApplyCard = {
  id: "01900000-0000-7000-8000-000000000001",
  title: "Associate PM intern",
  company: "Local startup",
  note: "",
  stage: "inbox",
  position: "a0",
  starred: true,
  jobUrl: null,
  demo: true,
  trackDate: "2026-08-26",
  trackKind: "followup",
  createdAt: "2026-08-25T00:00:00.000Z",
  updatedAt: "2026-08-25T00:00:00.000Z",
}

describe("apply API client", () => {
  it("lists Apply cards from GET /api/apply", async () => {
    const fetchMock = vi.fn().mockResolvedValue(envelope([card]))
    vi.stubGlobal("fetch", fetchMock)

    await expect(listApplyCards()).resolves.toEqual([card])
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(`${apiBaseUrl}/api/apply`)
  })

  it("creates and moves through the Command registry", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(envelope(card))
      .mockResolvedValueOnce(envelope({ ...card, stage: "prep" }))
    vi.stubGlobal("fetch", fetchMock)

    await expect(createApplyCard({ title: "Associate PM intern" })).resolves.toEqual(
      card
    )
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(
      `${apiBaseUrl}/api/commands/${APPLY_COMMANDS.createCard}`
    )

    await moveApplyCard({ cardId: card.id, stage: "prep" })
    expect(String(fetchMock.mock.calls[1]?.[0])).toBe(
      `${apiBaseUrl}/api/commands/${APPLY_COMMANDS.moveCard}`
    )
  })

  it("scans a posting through POST /api/apply/scan", async () => {
    const scan = {
      title: "Associate PM intern",
      company: "Local startup",
      note: "Hanoi",
    }
    const fetchMock = vi.fn().mockResolvedValue(envelope(scan))
    vi.stubGlobal("fetch", fetchMock)

    await expect(
      scanApplyJob({
        jdText: "Local startup is hiring an Associate PM intern in Hanoi.",
      })
    ).resolves.toEqual(scan)
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(
      `${apiBaseUrl}/api/apply/scan`
    )
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ method: "POST" })
  })
})

describe("apply list helpers", () => {
  it("inserts a moved card between neighbors without exposing fit", () => {
    const first = { ...card, id: "a", position: "a0" }
    const second = { ...card, id: "b", title: "Second", position: "a1" }
    const moved = optimisticMoveCard([first, second], "b", "inbox", "a")
    expect(moved.map((item) => item.id)).toEqual(["b", "a"])
    expect(moved[0]!.position < moved[1]!.position).toBe(true)
    expect(JSON.stringify(moved)).not.toMatch(/"fit"/)
  })
})
