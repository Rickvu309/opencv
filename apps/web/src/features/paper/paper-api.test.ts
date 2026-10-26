import { afterEach, describe, expect, it, vi } from "vitest"

import { apiBaseUrl } from "@/lib/api-url.ts"

import {
  createPaper,
  deletePaper,
  getPaperPages,
  listPaperDocs,
  listPaperFiles,
  replacePaper,
  sharePaper,
  upsertPaperDoc,
} from "./paper-api.ts"
import type { PaperDoc } from "@workspace/domain"

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
  applyCardId: null,
  createdAt: "2026-08-25T00:00:00.000Z",
  updatedAt: "2026-08-25T00:00:00.000Z",
}

function bodyOf(call: unknown[]) {
  const init = call[1] as RequestInit | undefined
  return JSON.parse(String(init?.body ?? "{}")) as unknown
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("paper API client", () => {
  it("lists Paper docs from GET /api/paper", async () => {
    const fetchMock = vi.fn().mockResolvedValue(envelope([doc]))
    vi.stubGlobal("fetch", fetchMock)

    await expect(listPaperDocs()).resolves.toEqual([doc])
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(`${apiBaseUrl}/api/paper`)
  })

  it("creates, replaces, deletes, and shares through the command paths", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(envelope(doc))
      .mockResolvedValueOnce(envelope({ ...doc, contentVersion: 2 }))
      .mockResolvedValueOnce(envelope({ docId: doc.id }))
      .mockResolvedValueOnce(envelope({ token: "share-token" }))
    vi.stubGlobal("fetch", fetchMock)

    await createPaper({ kind: "cv", templateId: "simple" })
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(
      `${apiBaseUrl}/api/commands/paper.create`
    )
    expect(bodyOf(fetchMock.mock.calls[0] ?? [])).toEqual({
      kind: "cv",
      templateId: "simple",
    })

    await replacePaper({
      docId: doc.id,
      contentVersion: 1,
      document: doc.content,
    })
    expect(String(fetchMock.mock.calls[1]?.[0])).toBe(
      `${apiBaseUrl}/api/commands/paper.replace`
    )
    expect(bodyOf(fetchMock.mock.calls[1] ?? [])).toEqual({
      docId: doc.id,
      contentVersion: 1,
      document: doc.content,
    })

    await deletePaper(doc.id)
    expect(String(fetchMock.mock.calls[2]?.[0])).toBe(
      `${apiBaseUrl}/api/commands/paper.delete`
    )
    expect(bodyOf(fetchMock.mock.calls[2] ?? [])).toEqual({ docId: doc.id })

    await expect(sharePaper(doc.id)).resolves.toEqual({ token: "share-token" })
    expect(String(fetchMock.mock.calls[3]?.[0])).toBe(
      `${apiBaseUrl}/api/commands/paper.share`
    )
    expect(bodyOf(fetchMock.mock.calls[3] ?? [])).toEqual({ docId: doc.id })
  })

  it("reads files and pages before the document id route", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(envelope([]))
      .mockResolvedValueOnce(
        envelope({ docId: doc.id, pages: 2, pageChoice: "unset" })
      )
    vi.stubGlobal("fetch", fetchMock)

    await expect(listPaperFiles()).resolves.toEqual([])
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(
      `${apiBaseUrl}/api/paper/files`
    )

    await expect(getPaperPages(doc.id)).resolves.toEqual({
      docId: doc.id,
      pages: 2,
      pageChoice: "unset",
    })
    expect(String(fetchMock.mock.calls[1]?.[0])).toBe(
      `${apiBaseUrl}/api/paper/${doc.id}/pages`
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
