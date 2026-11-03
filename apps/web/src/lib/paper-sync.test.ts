import "fake-indexeddb/auto"

import { type PaperDocument } from "@workspace/domain"
import { materialize, writeDocument } from "@workspace/paper-crdt"
import { describe, expect, it, vi } from "vitest"
import * as Y from "yjs"

import { ApiError } from "./api-error.ts"
import {
  DOC,
  fakeServer,
  letter,
  open,
  server,
  textOf,
  type,
} from "@/test/paper-sync-kit.ts"
import { type PaperSync } from "./paper-sync.ts"
import { indexedDbStore, memoryStore } from "./paper-sync-store.ts"

describe("openPaperSync", () => {
  it("loads the document and shows Saved", async () => {
    fakeServer(letter(["p1", "Hello"]))
    const sync = await open()
    expect(sync.status()).toBe("saved")
    expect(textOf(sync, "p1")).toBe("Hello")
  })

  it("keeps one push in flight and sends typing after the debounce", async () => {
    const remote = fakeServer(letter(["p1", "Hello"]))
    const sync = await open()
    const before = remote.state.calls.length
    type(sync, "p1", "Hello there")
    type(sync, "p1", "Hello there again")
    sync.poke()
    sync.poke()
    await vi.advanceTimersByTimeAsync(500)
    expect(remote.state.peak).toBe(1)
    expect(remote.state.calls.length).toBeGreaterThan(before)
    expect(sync.status()).toBe("saved")
    expect(JSON.stringify(materialize(remote.state.doc))).toContain(
      "Hello there again"
    )
  })

  it("retries after the network returns and says so", async () => {
    const remote = fakeServer(letter(["p1", "Hello"]))
    const sync = await open()
    remote.state.online = false
    type(sync, "p1", "Offline words")
    await vi.advanceTimersByTimeAsync(500)
    expect(sync.status()).toBe("offline")
    remote.state.online = true
    await vi.advanceTimersByTimeAsync(2000)
    expect(sync.status()).toBe("saved")
    expect(sync.client()!.hasPending()).toBe(false)
  })

  it("flushes with keepalive when the page hides", async () => {
    const remote = fakeServer(letter(["p1", "Hello"]))
    const sync = await open()
    type(sync, "p1", "Last words")
    window.dispatchEvent(new Event("pagehide"))
    await vi.advanceTimersByTimeAsync(0)
    expect(
      remote.state.calls.some(
        (call) => (call.options as { keepalive?: boolean }).keepalive === true
      )
    ).toBe(true)
  })

  it("restores unsynced typing from IndexedDB after a reload", async () => {
    const remote = fakeServer(letter(["p1", "Hello"]))
    const store = indexedDbStore()
    const first = await open({ store })
    remote.state.online = false
    type(first, "p1", "Typed offline")
    await vi.advanceTimersByTimeAsync(100)
    first.destroy()
    const second = await open({ store })
    await vi.advanceTimersByTimeAsync(0)
    expect(textOf(second, "p1")).toBe("Typed offline")
    remote.state.online = true
    await vi.advanceTimersByTimeAsync(2000)
    expect(JSON.stringify(materialize(remote.state.doc))).toContain(
      "Typed offline"
    )
  })

  it("keeps unsynced typing across an epoch reset", async () => {
    const remote = fakeServer(letter(["p1", "Hello"], ["p2", "World"]))
    const sync = await open()
    remote.state.online = false
    type(sync, "p1", "Hello and more")
    await vi.advanceTimersByTimeAsync(500)
    remote.state.online = true
    remote.reseed(letter(["p1", "Hello"], ["p2", "World reseeded"]))
    await vi.advanceTimersByTimeAsync(3000)
    expect(textOf(sync, "p1")).toBe("Hello and more")
    expect(textOf(sync, "p2")).toBe("World reseeded")
  })

  it("pulls when the document revision moves", async () => {
    const remote = fakeServer(letter(["p1", "Hello"]))
    const sync = await open()
    const coach = new Y.Doc()
    Y.applyUpdate(coach, Y.encodeStateAsUpdate(remote.state.doc))
    writeDocument(
      remote.state.doc,
      letter(["p1", "Hello from the Coach"]),
      "coach"
    )
    remote.state.revision += 1
    sync.noteRevision(remote.state.revision)
    await vi.advanceTimersByTimeAsync(0)
    await vi.advanceTimersByTimeAsync(0)
    expect(textOf(sync, "p1")).toBe("Hello from the Coach")
  })
})

function moveBlock(sync: PaperSync, id: string, after: string) {
  const client = sync.client()!
  const current = client.document()!
  const blocks = [...current.blocks]
  const from = blocks.findIndex((block) => block.id === id)
  const [node] = blocks.splice(from, 1)
  blocks.splice(blocks.findIndex((block) => block.id === after) + 1, 0, node!)
  writeDocument(client.ydoc, { ...current, blocks } as PaperDocument, "person")
}

describe("openPaperSync races", () => {
  it("stays read-only until the first reply when no record exists", async () => {
    const remote = fakeServer(letter(["p1", "Hello"]))
    remote.state.online = false
    const sync = await open()
    expect(sync.ready()).toBe(false)
    remote.state.online = true
    await vi.advanceTimersByTimeAsync(2000)
    expect(sync.ready()).toBe(true)
    expect(textOf(sync, "p1")).toBe("Hello")
  })

  it("keeps typing made while a push is in flight and a Coach reply is delayed", async () => {
    const remote = fakeServer(letter(["p1", "Hello"], ["p2", "World"]))
    const sync = await open()
    type(sync, "p1", "Hello first")
    let release = () => {}
    remote.state.gate = new Promise<void>((resolve) => {
      release = resolve
    })
    await vi.advanceTimersByTimeAsync(500)
    type(sync, "p1", "Hello first second")
    writeDocument(
      remote.state.doc,
      letter(["p1", "Hello"], ["p2", "World Coach"]),
      "coach"
    )
    remote.state.revision += 1
    remote.state.gate = null
    release()
    await vi.advanceTimersByTimeAsync(3000)
    expect(textOf(sync, "p1")).toBe("Hello first second")
    expect(textOf(sync, "p2")).toBe("World Coach")
    expect(sync.status()).toBe("saved")
    expect(JSON.stringify(materialize(remote.state.doc))).toContain(
      "first second"
    )
  })

  it("answers a stale structural push by rebasing and retrying at once", async () => {
    const remote = fakeServer(
      letter(["p1", "Hello"], ["p2", "World"], ["p3", "Tail"])
    )
    const sync = await open()
    writeDocument(
      remote.state.doc,
      letter(["p1", "Hello Coach"], ["p2", "World"], ["p3", "Tail"]),
      "coach"
    )
    remote.state.revision += 1
    moveBlock(sync, "p1", "p3")
    await vi.advanceTimersByTimeAsync(500)
    expect(remote.state.calls.some((call) => call.basedOn !== undefined)).toBe(
      true
    )
    expect(sync.status()).toBe("saved")
    const served = materialize(remote.state.doc)
    expect(served.ok && served.document.blocks.map((b) => b.id)).toEqual([
      "p2",
      "p3",
      "p1",
    ])
    expect(JSON.stringify(served)).toContain("Hello Coach")
  })

  it("never sends a keepalive while a push is in flight", async () => {
    const remote = fakeServer(letter(["p1", "Hello"]))
    const sync = await open()
    type(sync, "p1", "Hello one")
    let release = () => {}
    remote.state.gate = new Promise<void>((resolve) => {
      release = resolve
    })
    await vi.advanceTimersByTimeAsync(500)
    type(sync, "p1", "Hello one two")
    const before = remote.state.calls.length
    window.dispatchEvent(new Event("pagehide"))
    remote.state.gate = null
    release()
    await vi.advanceTimersByTimeAsync(2000)
    expect(
      remote.state.calls
        .slice(before)
        .filter((call) => (call.options as { keepalive?: boolean }).keepalive)
    ).toHaveLength(0)
    expect(JSON.stringify(materialize(remote.state.doc))).toContain("one two")
  })

  it("sends a structural keepalive with the revision it was based on", async () => {
    const remote = fakeServer(letter(["p1", "Hello"], ["p2", "World"]))
    const sync = await open()
    moveBlock(sync, "p1", "p2")
    window.dispatchEvent(new Event("pagehide"))
    await vi.advanceTimersByTimeAsync(0)
    const call = remote.state.calls.find(
      (entry) => (entry.options as { keepalive?: boolean }).keepalive === true
    )
    expect(call?.basedOn).toBe(sync.client()!.revision)
  })

  it("persists before a keepalive size check so a big paste is not lost", async () => {
    fakeServer(letter(["p1", "Hello"]))
    const store = memoryStore()
    const sync = await open({ store })
    type(sync, "p1", "x".repeat(70_000))
    window.dispatchEvent(new Event("pagehide"))
    await vi.advanceTimersByTimeAsync(0)
    const kept = await store.load(DOC, "tab-a")
    expect(kept.own?.pending.length).toBeGreaterThan(60_000)
  })

  it("shows a failed local copy in the status", async () => {
    fakeServer(letter(["p1", "Hello"]))
    const base = memoryStore()
    const store: SyncStore = {
      ...base,
      save: () => Promise.reject(new Error("QuotaExceededError")),
    }
    const sync = await open({ store })
    type(sync, "p1", "Hello again")
    await vi.advanceTimersByTimeAsync(600)
    expect(sync.status()).toBe("local")
  })

  it("shows a refusal and stops retrying", async () => {
    const remote = fakeServer(letter(["p1", "Hello"]))
    const sync = await open()
    const real = server.run!
    server.run = () =>
      Promise.reject(new ApiError(400, "VALIDATION_ERROR", "no"))
    type(sync, "p1", "Hello x")
    await vi.advanceTimersByTimeAsync(600)
    expect(sync.status()).toBe("refused")
    const calls = remote.state.calls.length
    await vi.advanceTimersByTimeAsync(40_000)
    expect(remote.state.calls.length).toBe(calls)
    server.run = real
  })

  it("takes another tab's saved typing as its lead and removes that record", async () => {
    const remote = fakeServer(letter(["p1", "Hello"], ["p2", "World"]))
    const store = memoryStore()
    const lone = await open({ store, tabId: "tab-old" })
    type(lone, "p1", "Hello orphan")
    await vi.advanceTimersByTimeAsync(100)
    lone.destroy()
    writeDocument(
      remote.state.doc,
      letter(["p1", "Hello"], ["p2", "World Coach"]),
      "coach"
    )
    remote.state.revision += 1
    const next = await open({ store, tabId: "tab-new" })
    await vi.advanceTimersByTimeAsync(3000)
    expect(textOf(next, "p1")).toBe("Hello orphan")
    expect(textOf(next, "p2")).toBe("World Coach")
    expect((await store.load(DOC, "tab-new")).orphans).toHaveLength(0)
    expect((await store.load(DOC, "tab-old")).own).toBeNull()
  })

  it("re-runs after a revision noted during a push", async () => {
    const remote = fakeServer(letter(["p1", "Hello"]))
    const sync = await open()
    type(sync, "p1", "Hello noted")
    let release = () => {}
    remote.state.gate = new Promise<void>((resolve) => {
      release = resolve
    })
    await vi.advanceTimersByTimeAsync(500)
    const during = remote.state.calls.length
    sync.noteRevision(sync.client()!.revision + 5)
    remote.state.gate = null
    release()
    await vi.advanceTimersByTimeAsync(100)
    expect(remote.state.calls.length).toBeGreaterThan(during + 1)
  })

  it("does not call the server while typing offline until the backoff ends", async () => {
    const remote = fakeServer(letter(["p1", "Hello"]))
    const sync = await open()
    remote.state.online = false
    type(sync, "p1", "Hello a")
    await vi.advanceTimersByTimeAsync(600)
    expect(sync.status()).toBe("offline")
    const calls = remote.state.calls.length
    type(sync, "p1", "Hello ab")
    await vi.advanceTimersByTimeAsync(200)
    type(sync, "p1", "Hello abc")
    await vi.advanceTimersByTimeAsync(450)
    expect(remote.state.calls.length).toBe(calls)
    remote.state.online = true
    await vi.advanceTimersByTimeAsync(5000)
    expect(sync.status()).toBe("saved")
    expect(JSON.stringify(materialize(remote.state.doc))).toContain("Hello abc")
  })

  it("shows its own status when the server keeps moving, then recovers", async () => {
    const remote = fakeServer(letter(["p1", "Hello"]))
    const sync = await open()
    const real = server.run!
    server.run = (input, options) => {
      remote.state.revision += 1
      return real(input, options)
    }
    type(sync, "p1", "Hello busy")
    await vi.advanceTimersByTimeAsync(700)
    expect(sync.status()).toBe("contended")
    server.run = real
    await vi.advanceTimersByTimeAsync(5000)
    expect(sync.status()).toBe("saved")
    expect(JSON.stringify(materialize(remote.state.doc))).toContain(
      "Hello busy"
    )
  })

  it("sends one keepalive when the page hides and then unloads", async () => {
    const remote = fakeServer(letter(["p1", "Hello"]))
    const sync = await open()
    type(sync, "p1", "Hello twice")
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "hidden",
    })
    document.dispatchEvent(new Event("visibilitychange"))
    window.dispatchEvent(new Event("pagehide"))
    await vi.advanceTimersByTimeAsync(0)
    Reflect.deleteProperty(document, "visibilityState")
    expect(
      remote.state.calls.filter(
        (call) => (call.options as { keepalive?: boolean }).keepalive
      )
    ).toHaveLength(1)
    expect(JSON.stringify(materialize(remote.state.doc))).toContain(
      "Hello twice"
    )
  })

  it("closes the store when the tab goes away and keeps the revision in the record", async () => {
    fakeServer(letter(["p1", "Hello"]))
    const base = memoryStore()
    let closed = 0
    const store: SyncStore = {
      ...base,
      close: async () => {
        closed += 1
      },
    }
    const sync = await open({ store })
    type(sync, "p1", "Hello kept")
    await vi.advanceTimersByTimeAsync(1000)
    const kept = await store.load(DOC, "tab-a")
    expect(kept.own?.revision).toBe(sync.client()!.revision)
    sync.destroy()
    expect(closed).toBe(1)
  })

  it("does not call the server while typing during a busy wait", async () => {
    const remote = fakeServer(letter(["p1", "Hello"]))
    const sync = await open()
    const real = server.run!
    server.run = (input, options) => {
      remote.state.revision += 1
      return real(input, options)
    }
    type(sync, "p1", "Hello busy")
    await vi.advanceTimersByTimeAsync(410)
    expect(sync.status()).toBe("contended")
    const calls = remote.state.calls.length
    type(sync, "p1", "Hello busy again")
    await vi.advanceTimersByTimeAsync(440)
    expect(sync.status()).toBe("contended")
    expect(remote.state.calls.length).toBe(calls)
    server.run = real
    await vi.advanceTimersByTimeAsync(5000)
    expect(sync.status()).toBe("saved")
  })

  it("loads only the records of its own letter", async () => {
    const store = indexedDbStore()
    const empty = Y.encodeStateAsUpdate(new Y.Doc())
    await store.save("doc-a", "tab-1", {
      epoch: 1,
      server: empty,
      pending: empty,
    })
    await store.save("doc-b", "tab-2", {
      epoch: 1,
      server: empty,
      pending: empty,
    })
    vi.setSystemTime(Date.now() + 10 * 60 * 1000)
    const loaded = await store.load("doc-a", "tab-3")
    expect(loaded.orphans.map((orphan) => orphan.tabId)).toEqual(["tab-1"])
    await store.close()
  })
})
