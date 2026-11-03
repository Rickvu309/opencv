import "fake-indexeddb/auto"

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { materialize } from "@workspace/paper-crdt"
import { act, renderHook } from "@testing-library/react"
import { type ReactNode } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

import {
  DOC,
  fakeServer,
  letter,
  open,
  textOf,
  type,
} from "@/test/paper-sync-kit.ts"
import { usePaperSync } from "./paper-sync.ts"
import { lockOf, memoryStore } from "./paper-sync-store.ts"

vi.mock("./contract-client.ts", async (importOriginal) => {
  const original = await importOriginal<typeof import("./contract-client.ts")>()
  return {
    ...original,
    runContractCommand: async (
      _client: unknown,
      _name: unknown,
      input: unknown,
      options: unknown
    ) => (await import("@/test/paper-sync-kit.ts")).server.run!(input, options),
  }
})

const TAB_KEY = "paper-sync-tab"

function holdLocks(names: string[]) {
  Object.defineProperty(navigator, "locks", {
    configurable: true,
    value: {
      query: async () => ({ held: names.map((name) => ({ name })) }),
      request: vi.fn(async () => undefined),
    },
  })
}

afterEach(() => {
  Reflect.deleteProperty(navigator, "locks")
  sessionStorage.clear()
})

describe("tab identity", () => {
  it("makes a new tab id when the stored one is held by another tab", async () => {
    fakeServer(letter(["p1", "Hello"]))
    sessionStorage.setItem(TAB_KEY, "tab-held")
    holdLocks([lockOf(DOC, "tab-held")])
    const store = memoryStore()
    const sync = await open({ store, tabId: undefined })
    type(sync, "p1", "Hello again")
    await vi.advanceTimersByTimeAsync(1000)
    expect(sessionStorage.getItem(TAB_KEY)).not.toBe("tab-held")
    expect((await store.load(DOC, "tab-held")).own).toBeNull()
    expect((await store.load(DOC, "tab-held")).orphans).toHaveLength(1)
  })

  it("keeps the stored tab id when no other tab holds it", async () => {
    fakeServer(letter(["p1", "Hello"]))
    sessionStorage.setItem(TAB_KEY, "tab-mine")
    holdLocks([])
    const store = memoryStore()
    const sync = await open({ store, tabId: undefined })
    type(sync, "p1", "Hello again")
    await vi.advanceTimersByTimeAsync(1000)
    expect(sessionStorage.getItem(TAB_KEY)).toBe("tab-mine")
    expect((await store.load(DOC, "tab-mine")).own).not.toBeNull()
  })
})

describe("orphans from another epoch", () => {
  it("adopts the typing through the rebase and removes the record", async () => {
    const remote = fakeServer(letter(["p1", "Hello"], ["p2", "World"]))
    const store = memoryStore()
    const first = await open({ store, tabId: "tab-one" })
    type(first, "p1", "Hello one")
    await vi.advanceTimersByTimeAsync(100)
    first.destroy()
    remote.reseed(letter(["p1", "Hello"], ["p2", "World reseeded"]))
    const second = await open({ store, tabId: "tab-two" })
    await vi.advanceTimersByTimeAsync(3000)
    type(second, "p2", "World reseeded two")
    await vi.advanceTimersByTimeAsync(100)
    second.destroy()
    const next = await open({ store, tabId: "tab-new" })
    await vi.advanceTimersByTimeAsync(3000)
    expect(textOf(next, "p1")).toBe("Hello one")
    expect(textOf(next, "p2")).toBe("World reseeded two")
    expect((await store.load(DOC, "tab-new")).orphans).toHaveLength(0)
  })
})

describe("first open through the hook", () => {
  it("gives no editor client until the first reply, then the document", async () => {
    const remote = fakeServer(letter(["p1", "Hello"]))
    remote.state.online = false
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={new QueryClient()}>
        {children}
      </QueryClientProvider>
    )
    const { result, unmount } = renderHook(() => usePaperSync(DOC), {
      wrapper,
    })
    await act(() => vi.advanceTimersByTimeAsync(500))
    expect(result.current.client).toBeNull()
    remote.state.online = true
    await act(() => vi.advanceTimersByTimeAsync(3000))
    expect(result.current.client).not.toBeNull()
    expect(result.current.status).toBe("saved")
    expect(JSON.stringify(result.current.client!.document())).toContain("Hello")
    unmount()
  })
})

function serverTextOf(remote: ReturnType<typeof fakeServer>, id: string) {
  const read = materialize(remote.state.doc)
  const block = read.ok
    ? read.document.blocks.find((candidate) => candidate.id === id)
    : null
  return block && "content" in block
    ? block.content.map((run) => run.text).join("")
    : null
}

describe("records of other tabs", () => {
  it("keeps typing once when a keepalive delivered it and its record is adopted", async () => {
    const remote = fakeServer(letter(["p1", "Hello"], ["p2", "World"]))
    const store = memoryStore()
    const idle = await open({ store, tabId: "tab-idle" })
    const busy = await open({ store, tabId: "tab-busy" })
    type(busy, "p1", "Hello typed")
    await vi.advanceTimersByTimeAsync(100)
    busy.destroy()
    idle.destroy()
    await vi.advanceTimersByTimeAsync(0)
    expect(serverTextOf(remote, "p1")).toBe("Hello typed")
    const next = await open({ store, tabId: "tab-new" })
    await vi.advanceTimersByTimeAsync(3000)
    expect(serverTextOf(remote, "p1")).toBe("Hello typed")
    expect(textOf(next, "p1")).toBe("Hello typed")
    expect((await store.load(DOC, "tab-new")).orphans).toHaveLength(0)
  })

  it("does not double typing when a live idle tab is adopted as an orphan", async () => {
    const remote = fakeServer(letter(["p1", "Hello"], ["p2", "World"]))
    const store = memoryStore()
    await open({ store, tabId: "tab-first" })
    const live = await open({ store, tabId: "tab-live" })
    remote.state.online = false
    type(live, "p1", "Hello live")
    await vi.advanceTimersByTimeAsync(1000)
    remote.state.online = true
    const next = await open({ store, tabId: "tab-next" })
    await vi.advanceTimersByTimeAsync(60_000)
    expect(serverTextOf(remote, "p1")).toBe("Hello live")
    expect(textOf(next, "p1")).toBe("Hello live")
    expect(textOf(live, "p1")).toBe("Hello live")
  })
})
