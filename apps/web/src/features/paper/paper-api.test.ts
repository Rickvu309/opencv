import { QueryClient } from "@tanstack/react-query"
import { parsePaperId } from "@workspace/domain"
import { afterEach, describe, expect, it, vi } from "vitest"

import { apiBaseUrl } from "@/lib/api-url.ts"
import { runContractCommand } from "@/lib/contract-client.ts"

import {
  getPaperPages,
  importPaperFile,
  listPaper,
  listPaperFiles,
  paperGetKey,
  paperListKey,
  paperPagesKey,
} from "./paper-api.ts"

function envelope<T>(data: T) {
  return Response.json({ ok: true, data })
}

const docId = parsePaperId("11111111-1111-4111-8111-111111111111")

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("paper API client", () => {
  it("reads a PDF import's note beside the Word page, and refuses a note inside it", async () => {
    const page = {
      generation: "package",
      docId: "22222222-2222-4222-8222-222222222222",
      revision: "33333333-3333-4333-8333-333333333333",
      name: "Linh_CV",
      kind: "cv",
      packageHash: "a".repeat(64),
      byteSize: 1200,
    }
    const notice =
      "Imported the text of your PDF. Layout, fonts and photo were not kept."
    const file = new File(["CV"], "Linh_CV.pdf", { type: "application/pdf" })
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(Response.json({ ok: true, data: page, notice }))
    )
    await expect(importPaperFile(file)).resolves.toEqual({ ...page, notice })
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(envelope(page)))
    await expect(importPaperFile(file)).resolves.toEqual({
      ...page,
      notice: null,
    })
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(envelope({ ...page, notice }))
    )
    await expect(importPaperFile(file)).rejects.toThrow()
  })

  it("lists documents from GET /api/paper", async () => {
    const fetchMock = vi.fn().mockResolvedValue(envelope([]))
    vi.stubGlobal("fetch", fetchMock)

    await expect(listPaper()).resolves.toEqual([])
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(`${apiBaseUrl}/api/paper`)
  })

  it("reads files and pages before the document id route", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(envelope([]))
      .mockResolvedValueOnce(envelope({ docId, pages: 2, pageChoice: "unset" }))
    vi.stubGlobal("fetch", fetchMock)

    await expect(listPaperFiles()).resolves.toEqual([])
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(
      `${apiBaseUrl}/api/paper/files`
    )
    await expect(getPaperPages(docId)).resolves.toMatchObject({ pages: 2 })
    expect(String(fetchMock.mock.calls[1]?.[0])).toBe(
      `${apiBaseUrl}/api/paper/${docId}/pages`
    )
  })
})

describe("paper commands through the contract client", () => {
  it("sends the input with an idempotency key and refreshes what the contract names", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(envelope({ id: docId, previousName: "Old" }))
    vi.stubGlobal("fetch", fetchMock)
    const queryClient = new QueryClient()
    for (const key of [
      paperListKey(),
      paperGetKey(docId),
      paperPagesKey(docId),
    ]) {
      queryClient.setQueryData(key, { stale: true })
    }

    await runContractCommand(queryClient, "paper.rename", {
      docId,
      name: "New",
    })

    const call = fetchMock.mock.calls[0] ?? []
    expect(String(call[0])).toBe(`${apiBaseUrl}/api/commands/paper.rename`)
    expect(JSON.parse(String((call[1] as RequestInit).body))).toMatchObject({
      input: { docId, name: "New" },
    })
    for (const key of [
      paperListKey(),
      paperGetKey(docId),
      paperPagesKey(docId),
    ]) {
      expect(queryClient.getQueryState(key)?.isInvalidated).toBe(true)
    }
  })

  it("leaves the cache alone when asked not to refresh, as autosave does", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(envelope({ id: docId })))
    const queryClient = new QueryClient()
    queryClient.setQueryData(paperGetKey(docId), { stale: true })

    await runContractCommand(
      queryClient,
      "paper.sync",
      { docId, epoch: 0, update: "", stateVector: "" },
      { refresh: false }
    )

    expect(queryClient.getQueryState(paperGetKey(docId))?.isInvalidated).toBe(
      false
    )
  })

  it("sends an idempotency key unless the contract entry says none", async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation(() => Promise.resolve(envelope({ id: docId })))
    vi.stubGlobal("fetch", fetchMock)
    const queryClient = new QueryClient()
    const input = { docId, name: "New" }

    await runContractCommand(queryClient, "paper.rename", input)
    await runContractCommand(queryClient, "paper.sync", {
      docId,
      epoch: 0,
      update: "",
      stateVector: "",
    })

    const bodies = fetchMock.mock.calls.map((c) =>
      JSON.parse(String((c[1] as RequestInit).body))
    )
    expect(typeof bodies[0].idempotencyKey).toBe("string")
    expect(bodies[1]).not.toHaveProperty("idempotencyKey")
  })
})
