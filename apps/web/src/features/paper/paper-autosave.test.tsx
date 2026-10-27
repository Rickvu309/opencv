import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from "@tanstack/react-query"
import { parsePaperId, type PaperView } from "@workspace/domain"
import { act, renderHook } from "@testing-library/react"
import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  getPaper,
  getPaperPages,
  listPaper,
  paperGetKey,
  paperListKey,
  paperPagesKey,
} from "./paper-api.ts"
import { usePaperAutosave } from "./paper-autosave.ts"

const docId = parsePaperId("11111111-1111-4111-8111-111111111111")
const saved = { id: docId, contentVersion: 2 } as PaperView

function ok(data: unknown) {
  return Response.json({ ok: true, data })
}

function setup() {
  const requests: { url: string; body: unknown }[] = []
  vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    const body = typeof init?.body === "string" ? JSON.parse(init.body) : null
    requests.push({ url, body })
    if (url.includes("/api/commands/paper.replace")) {
      return Promise.resolve(ok(saved))
    }
    if (url.endsWith("/pages")) {
      return Promise.resolve(ok({ docId, pages: 1, pageChoice: "unset" }))
    }
    if (url.endsWith("/api/paper")) return Promise.resolve(ok([]))
    return Promise.resolve(ok(saved))
  })
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
  const view = renderHook(
    () => {
      useQuery({ queryKey: paperGetKey(docId), queryFn: () => getPaper(docId) })
      useQuery({ queryKey: paperListKey(), queryFn: listPaper })
      useQuery({
        queryKey: paperPagesKey(docId),
        queryFn: () => getPaperPages(docId),
      })
      return usePaperAutosave<string>({
        docId,
        initialVersion: 1,
        toDocument: (markdown) => ({ markdown }),
        onSaved: () => {},
        onConflict: () => {},
        onError: () => {},
      })
    },
    { wrapper }
  )
  const count = (suffix: string) =>
    requests.filter((r) => r.url.endsWith(suffix)).length
  return { requests, view, count }
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe("paper autosave", () => {
  it("sends no idempotency key on a save", async () => {
    const { requests, view } = setup()
    await vi.waitFor(() => expect(requests.length).toBe(3))
    act(() => view.result.current.schedule("Hello"))
    await act(() => vi.advanceTimersByTimeAsync(800))

    const save = requests.find((r) => r.url.includes("paper.replace"))
    expect(save?.body).toMatchObject({ input: { docId, contentVersion: 1 } })
    expect(save?.body).not.toHaveProperty("idempotencyKey")
  })

  it("never refetches the open document while typing, and refreshes the list and page count once when the queue drains", async () => {
    const { requests, view, count } = setup()
    await vi.waitFor(() => expect(requests.length).toBe(3))
    const before = requests.length

    for (const text of ["H", "He", "Hel"]) {
      act(() => view.result.current.schedule(text))
      await act(() => vi.advanceTimersByTimeAsync(100))
    }
    await act(() => vi.advanceTimersByTimeAsync(1000))
    await vi.waitFor(() => expect(count("/pages")).toBe(2))

    const after = requests.slice(before)
    expect(after.filter((r) => r.url.includes("paper.replace"))).toHaveLength(1)
    expect(
      after.filter((r) => r.url.endsWith(`/api/paper/${docId}`))
    ).toHaveLength(0)
    expect(count("/api/paper")).toBe(2)
    expect(count("/pages")).toBe(2)
  })
})
