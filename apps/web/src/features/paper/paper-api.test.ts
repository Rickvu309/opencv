import { QueryClient } from "@tanstack/react-query"
import { parsePaperId } from "@workspace/domain/kernel"
import { afterEach, describe, expect, it, vi } from "vitest"

import { apiBaseUrl } from "@/lib/api-url.ts"
import { catalogClient, queryKey } from "@/lib/contract-client.ts"

import { paperListQuery, readPaperList } from "@/lib/paper-list.ts"

import { importPaperFile } from "./paper-api.ts"

function envelope<T>(data: T) {
  return Response.json({ ok: true, data })
}

const docId = parsePaperId("11111111-1111-4111-8111-111111111111")

const saved = { ok: true, head: 1 }

const typed = {
  docId,
  client: "tab-paper-api",
  base: 0,
  changes: [
    {
      edit: "edit-paper-api",
      origin: {
        kind: "person" as const,
        actor: "person",
        client: "tab-paper-api",
      },
      base: 0,
      steps: [],
      inverse: [],
      commands: [],
    },
  ],
}

afterEach(() => {
  vi.unstubAllGlobals()
})

const paperInfoKey = (docId: string) =>
  queryKey({ query: "paper.outline", input: { docId } })

describe("paper API client", () => {
  it("reads a PDF import's note with the new Paper, and refuses a note outside it", async () => {
    const paper = {
      docId: "22222222-2222-4222-8222-222222222222",
      name: "Linh_CV",
      kind: "cv",
    }
    const notice =
      "Imported the text of your PDF. Layout, fonts and photo were not kept."
    const file = new File(["CV"], "Linh_CV.pdf", { type: "application/pdf" })
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(envelope({ ...paper, notice }))
    )
    await expect(importPaperFile(file)).resolves.toEqual({ ...paper, notice })
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(envelope(paper)))
    await expect(importPaperFile(file)).resolves.toEqual({
      ...paper,
      notice: null,
    })
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(Response.json({ ok: true, data: paper, notice }))
    )
    await expect(importPaperFile(file)).rejects.toThrow()
  })

  it.each([
    [429, "IMPORT_READ_LIMITED", "Your last file is still being read."],
    [503, "IMPORT_READ_BUSY", "Many files are being read right now."],
    [422, "FILE_UNSUPPORTED", "This PDF has more than 20 pages."],
  ])(
    "turns a %i import refusal into the server's code and sentence, and sends the cancel signal",
    async (status, code, message) => {
      const fetchMock = vi
        .fn()
        .mockResolvedValue(
          Response.json(
            { ok: false, error: { code, message } },
            { status, headers: { "Retry-After": "60" } }
          )
        )
      vi.stubGlobal("fetch", fetchMock)
      const stop = new AbortController()
      const refused = await importPaperFile(
        new File(["CV"], "Linh_CV.pdf", { type: "application/pdf" }),
        stop.signal
      ).catch((error: unknown) => error)
      expect(refused).toMatchObject({ status, code, message })
      expect(fetchMock.mock.calls[0]?.[1]?.signal).toBe(stop.signal)
    }
  )

  it("keeps a plain sentence when a gateway answers an import without JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response("<html>Gateway</html>", { status: 504 })
        )
    )
    await expect(
      importPaperFile(new File(["CV"], "Linh_CV.pdf"))
    ).rejects.toMatchObject({
      status: 504,
      message: "Could not import that file. Try it again.",
    })
  })

  it("lists documents through the catalog read door", async () => {
    const fetchMock = vi.fn().mockResolvedValue(envelope([]))
    vi.stubGlobal("fetch", fetchMock)

    await expect(readPaperList()).resolves.toEqual([])
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(
      `${apiBaseUrl}/api/reads/paper.list`
    )
  })

  it("reads files through the catalog read door", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(envelope([]))
    vi.stubGlobal("fetch", fetchMock)

    await expect(catalogClient.read("paper.files", {})).resolves.toEqual([])
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(
      `${apiBaseUrl}/api/reads/paper.files`
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
    const list = paperListQuery("owner")
    queryClient.getQueryCache().build(queryClient, list)
    for (const key of [list.queryKey, paperInfoKey(docId)]) {
      queryClient.setQueryData(key, { stale: true })
    }

    await catalogClient.run(queryClient, "paper.delete", { docId })

    const call = fetchMock.mock.calls[0] ?? []
    expect(String(call[0])).toBe(`${apiBaseUrl}/api/commands/paper.delete`)
    expect(JSON.parse(String((call[1] as RequestInit).body))).toMatchObject({
      input: { docId },
    })
    for (const key of [list.queryKey, paperInfoKey(docId)]) {
      expect(queryClient.getQueryState(key)?.isInvalidated).toBe(true)
    }
  })

  it("leaves the cache alone when asked not to refresh, as autosave does", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(envelope(saved)))
    const queryClient = new QueryClient()
    queryClient.setQueryData(paperInfoKey(docId), { stale: true })

    await catalogClient.run(queryClient, "paper.save", typed, {
      refresh: false,
    })

    expect(queryClient.getQueryState(paperInfoKey(docId))?.isInvalidated).toBe(
      false
    )
  })

  it("sends an idempotency key unless the contract entry says none", async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation((url: unknown) =>
        Promise.resolve(
          envelope(String(url).endsWith("paper.save") ? saved : { id: docId })
        )
      )
    vi.stubGlobal("fetch", fetchMock)
    const queryClient = new QueryClient()
    const input = { docId }

    await catalogClient.run(queryClient, "paper.delete", input)
    await catalogClient.run(queryClient, "paper.save", typed)

    const bodies = fetchMock.mock.calls.map((c) =>
      JSON.parse(String((c[1] as RequestInit).body))
    )
    expect(typeof bodies[0].idempotencyKey).toBe("string")
    expect(bodies[1]).not.toHaveProperty("idempotencyKey")
  })
})
