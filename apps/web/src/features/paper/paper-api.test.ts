import { PAPER_COMMANDS, type PaperDoc } from "@workspace/domain"
import { afterEach, describe, expect, it, vi } from "vitest"

import { apiBaseUrl } from "@/lib/api-url.ts"

import {
  createPaperDoc,
  listPaperDocs,
  updatePaperContent,
  upsertPaperDoc,
} from "./paper-api.ts"

afterEach(() => {
  vi.unstubAllGlobals()
})

function envelope<T>(data: T) {
  return Response.json({ ok: true, data })
}

const doc: PaperDoc = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "PM track CV",
  kind: "cv",
  status: "draft",
  content: { markdown: "nope" },
  contentVersion: 1,
  createdAt: "2026-08-25T00:00:00.000Z",
  updatedAt: "2026-08-25T00:00:00.000Z",
}

describe("paper API client", () => {
  it("lists Paper docs from GET /api/paper", async () => {
    const fetchMock = vi.fn().mockResolvedValue(envelope([doc]))
    vi.stubGlobal("fetch", fetchMock)

    await expect(listPaperDocs()).resolves.toEqual([doc])
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(`${apiBaseUrl}/api/paper`)
  })

  it("creates and updates through the Command registry", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(envelope(doc))
      .mockResolvedValueOnce(envelope({ ...doc, status: "ready" }))
    vi.stubGlobal("fetch", fetchMock)

    await expect(createPaperDoc({ kind: "cv" })).resolves.toEqual(doc)
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(
      `${apiBaseUrl}/api/commands/${PAPER_COMMANDS.createDoc}`
    )

    await updatePaperContent({
      docId: doc.id,
      content: doc.content,
      contentVersion: 1,
    })
    expect(String(fetchMock.mock.calls[1]?.[0])).toBe(
      `${apiBaseUrl}/api/commands/${PAPER_COMMANDS.updateContent}`
    )
  })
})

describe("paper list helpers", () => {
  it("moves an upserted doc to the front", () => {
    const older = { ...doc, id: "a", name: "Older" }
    const newer = { ...doc, id: "b", name: "Newer" }
    expect(upsertPaperDoc([older], newer).map((item) => item.id)).toEqual([
      "b",
      "a",
    ])
  })
})
