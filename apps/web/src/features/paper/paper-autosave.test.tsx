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

function setup(onReplace?: (count: number) => Promise<Response> | Response) {
  const requests: { url: string; body: unknown; keepalive?: boolean }[] = []
  let replaces = 0
  vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    const body = typeof init?.body === "string" ? JSON.parse(init.body) : null
    requests.push({ url, body, keepalive: init?.keepalive })
    if (url.includes("/api/commands/paper.replace")) {
      replaces += 1
      if (onReplace) return onReplace(replaces)
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

  it("sends a pending edit with keepalive when the page hides during a save", async () => {
    let rejectFirst: (error: unknown) => void = () => {}
    const first = new Promise<Response>((_resolve, reject) => {
      rejectFirst = reject
    })
    const { requests, view } = setup((count) => {
      if (count === 1) return first
      return Promise.resolve(ok({ ...saved, contentVersion: 3 }))
    })
    await vi.waitFor(() => expect(requests.length).toBe(3))
    act(() => view.result.current.schedule("first"))
    await act(() => vi.advanceTimersByTimeAsync(800))
    act(() => view.result.current.schedule("second"))
    await act(async () => {
      window.dispatchEvent(new Event("pagehide"))
    })
    await act(async () => {
      rejectFirst(Object.assign(new Error("aborted"), { name: "AbortError" }))
      await vi.advanceTimersByTimeAsync(0)
    })

    const saves = requests.filter((request) =>
      request.url.includes("paper.replace")
    )
    expect(saves).toHaveLength(2)
    expect(saves[1]?.keepalive).toBe(true)
    expect(saves[1]?.body).toMatchObject({
      input: { document: { markdown: "second" } },
    })
  })

  it("uses a normal save after the page is shown again", async () => {
    const { requests, view } = setup()
    await vi.waitFor(() => expect(requests.length).toBe(3))
    act(() => view.result.current.schedule("hide"))
    await act(async () => {
      window.dispatchEvent(new Event("pagehide"))
    })
    await vi.waitFor(() =>
      expect(
        requests.filter((request) => request.url.includes("paper.replace"))
      ).toHaveLength(1)
    )
    await act(async () => {
      window.dispatchEvent(new Event("pageshow"))
    })
    act(() => view.result.current.schedule("show"))
    await act(() => vi.advanceTimersByTimeAsync(800))

    const saves = requests.filter((request) =>
      request.url.includes("paper.replace")
    )
    expect(saves[0]?.keepalive).toBe(true)
    expect(saves[1]?.keepalive).not.toBe(true)
    expect(saves[1]?.body).toMatchObject({
      input: { document: { markdown: "show" } },
    })
  })
})
