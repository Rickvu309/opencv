import "fake-indexeddb/auto"

import { expect, it, vi } from "vitest"

import {
  DOC,
  fakeServer,
  letter,
  open,
  textOf,
  type,
} from "@/test/paper-sync-kit.ts"
import {
  journalScope,
  journalUpdates,
  recoverJournals,
} from "./paper-sync-journal.ts"
import {
  indexedDbStore,
  memoryStore,
  type SyncStore,
} from "./paper-sync-store.ts"

function uncommittedStore(): SyncStore {
  const inner = indexedDbStore()
  return {
    load: (docId, tabId) => inner.load(docId, tabId),
    async save() {
      await new Promise<void>(() => {})
    },
    remove: (docId, tabId) => inner.remove(docId, tabId),
    removeDoc: (docId) => inner.removeDoc(docId),
    prune: (docId, now) => inner.prune(docId, now),
    close: () => inner.close(),
  }
}

it("recovers words after a completed local save", async () => {
  const backend = fakeServer(letter(["t1", "Old words."]))
  const store = memoryStore()
  const first = await open({ store, tabId: "crash-tab" })
  await vi.advanceTimersByTimeAsync(100)
  backend.state.online = false
  type(first, "t1", "Old words. Last typed words.")
  expect(textOf(first, "t1")).toContain("Last typed words.")
  const beforeCrash = await store.load(DOC, "crash-tab")
  const durableOnly = memoryStore()
  if (beforeCrash.own) await durableOnly.save(DOC, "crash-tab", beforeCrash.own)
  const second = await open({ store: durableOnly, tabId: "crash-tab" })
  expect(textOf(second, "t1")).toContain("Last typed words.")
})

it("keeps completed input across ordinary close before IndexedDB completes", async () => {
  const backend = fakeServer(letter(["t1", "Old words."]))
  const first = await open({ store: uncommittedStore(), tabId: "crash-tab" })
  await vi.advanceTimersByTimeAsync(100)
  backend.state.online = false
  type(first, "t1", "Old words. INSIDE50")
  expect(first.status()).not.toBe("saved")
  expect(
    recoverJournals(localStorage, DOC).flatMap(({ updates }) => updates).length
  ).toBeGreaterThan(0)
  first.destroy()
  const second = await open({ store: uncommittedStore(), tabId: "crash-tab" })
  await vi.advanceTimersByTimeAsync(100)
  expect(textOf(second, "t1")).toContain("INSIDE50")
  expect(second.status()).not.toBe("saved")
})

it("writes the journal before save starts", async () => {
  fakeServer(letter(["t1", "Old words."]))
  const store = memoryStore()
  const sync = await open({ store, tabId: "order-tab" })
  await vi.advanceTimersByTimeAsync(100)
  const inner = store.save.bind(store)
  let sawJournal = false
  store.save = async (docId, tabId, stored) => {
    sawJournal =
      recoverJournals(localStorage, DOC).flatMap(({ updates }) => updates)
        .length > 0
    return inner(docId, tabId, stored)
  }
  type(sync, "t1", "Old words. ORDER")
  expect(sawJournal).toBe(true)
})

it("recovers both tabs when neither IndexedDB write completes", async () => {
  const backend = fakeServer(letter(["a", "Old A."], ["b", "Old B."]))
  const a = await open({ store: uncommittedStore(), tabId: "writer-a" })
  const b = await open({ store: uncommittedStore(), tabId: "writer-b" })
  await vi.advanceTimersByTimeAsync(100)
  backend.state.online = false
  type(a, "a", "Old A. KEPT-A")
  type(b, "b", "Old B. KEPT-B")
  expect(recoverJournals(localStorage, DOC)).toHaveLength(2)
  a.destroy()
  b.destroy()
  const recovered = await open({ store: uncommittedStore(), tabId: "reopened" })
  await vi.advanceTimersByTimeAsync(100)
  expect(textOf(recovered, "a")).toContain("KEPT-A")
  expect(textOf(recovered, "b")).toContain("KEPT-B")
})

it("clears the journal only after IndexedDB commits and the server accepts", async () => {
  const backend = fakeServer(letter(["t1", "Old words."]))
  const store = indexedDbStore()
  const sync = await open({ store, tabId: "clear-tab" })
  await vi.advanceTimersByTimeAsync(100)
  expect(sync.status()).toBe("saved")
  backend.state.online = false
  type(sync, "t1", "Old words. KEPT")
  await vi.advanceTimersByTimeAsync(1000)
  expect(sync.status()).not.toBe("saved")
  expect(
    recoverJournals(localStorage, DOC).flatMap(({ updates }) => updates).length
  ).toBeGreaterThan(0)
  expect((await store.load(DOC, "clear-tab")).own).not.toBeNull()
  backend.state.online = true
  sync.poke()
  await vi.advanceTimersByTimeAsync(1000)
  expect(sync.status()).toBe("saved")
  expect(
    recoverJournals(localStorage, DOC).flatMap(({ updates }) => updates)
  ).toEqual([])
})

it("leaves another tab's journal alone when lock ownership is unknown", async () => {
  vi.stubGlobal("navigator", {})
  const backend = fakeServer(letter(["t1", "Old words."]))
  const a = await open({ store: memoryStore(), tabId: "unknown-a" })
  await vi.advanceTimersByTimeAsync(100)
  backend.state.online = false
  type(a, "t1", "Old words. LIVE-A")
  await vi.advanceTimersByTimeAsync(100)
  backend.state.online = true
  await open({ store: memoryStore(), tabId: "unknown-b" })
  await vi.advanceTimersByTimeAsync(100)
  expect(
    journalUpdates(localStorage, journalScope(DOC, "unknown-a"))
  ).not.toEqual([])
})

it("rejects a save when request success is followed by a transaction abort", async () => {
  vi.useRealTimers()
  const store = indexedDbStore()
  const original = IDBObjectStore.prototype.put
  let aborted: Promise<void> | undefined
  const patch = vi
    .spyOn(IDBObjectStore.prototype, "put")
    .mockImplementation(function (this: IDBObjectStore, ...args) {
      const request = original.apply(this, args)
      aborted = new Promise((resolve) => {
        this.transaction!.addEventListener("abort", () => resolve(), {
          once: true,
        })
      })
      request.addEventListener(
        "success",
        () => {
          this.transaction!.abort()
        },
        { once: true }
      )
      return request
    })
  try {
    await expect(
      store.save("abort-doc", "abort-tab", {
        epoch: 1,
        server: new Uint8Array(),
        pending: new Uint8Array(),
      })
    ).rejects.toThrow()
    await aborted
    expect((await store.load("abort-doc", "abort-tab")).own).toBeNull()
  } finally {
    patch.mockRestore()
    await store.close()
  }
})

function controlledStore() {
  const inner = memoryStore()
  const writes: { complete(): void; abort(): void }[] = []
  let held = false
  const store: SyncStore = {
    ...inner,
    async save(docId, tabId, snapshot) {
      if (held)
        await new Promise<void>((resolve, reject) => {
          writes.push({
            complete: resolve,
            abort: () => reject(new Error("transaction aborted")),
          })
        })
      await inner.save(docId, tabId, snapshot)
    },
  }
  return {
    store,
    writes,
    hold: () => {
      held = true
    },
  }
}

it("waits for the current local transaction after a fast receipt", async () => {
  fakeServer(letter(["t1", "Old words."]))
  const local = controlledStore()
  const sync = await open({ store: local.store })
  await vi.advanceTimersByTimeAsync(100)
  expect(sync.status()).toBe("saved")
  local.hold()
  type(sync, "t1", "RECEIPT_BEFORE_D")
  await vi.advanceTimersByTimeAsync(400)
  expect(sync.client()!.hasPending()).toBe(false)
  expect(sync.status()).toBe("saving")
  local.writes.shift()!.complete()
  await vi.advanceTimersByTimeAsync(0)
  expect(sync.status()).toBe("saved")
})

it("an older completion cannot cover newer accepted words", async () => {
  fakeServer(letter(["t1", "Old words."]))
  const local = controlledStore()
  const sync = await open({ store: local.store })
  await vi.advanceTimersByTimeAsync(100)
  local.hold()
  type(sync, "t1", "FIRST")
  await vi.advanceTimersByTimeAsync(400)
  type(sync, "t1", "SECOND")
  await vi.advanceTimersByTimeAsync(400)
  expect(sync.client()!.hasPending()).toBe(false)
  local.writes.shift()!.complete()
  await vi.advanceTimersByTimeAsync(0)
  expect(sync.status()).toBe("saving")
  local.writes.shift()!.complete()
  await vi.advanceTimersByTimeAsync(0)
  expect(sync.status()).toBe("saved")
})

it("an aborted transaction cannot combine with a receipt to show Saved", async () => {
  fakeServer(letter(["t1", "Old words."]))
  const local = controlledStore()
  const sync = await open({ store: local.store })
  await vi.advanceTimersByTimeAsync(100)
  local.hold()
  type(sync, "t1", "ABORT_BEFORE_D")
  await vi.advanceTimersByTimeAsync(400)
  local.writes.shift()!.abort()
  await vi.advanceTimersByTimeAsync(0)
  expect(sync.status()).toBe("local")
  expect(recoverJournals(localStorage, DOC)).not.toHaveLength(0)
  local.writes.shift()!.complete()
  await vi.advanceTimersByTimeAsync(0)
  expect(sync.status()).toBe("saved")
  expect(journalUpdates(localStorage, journalScope(DOC, "tab-a"))).toHaveLength(
    0
  )
})
