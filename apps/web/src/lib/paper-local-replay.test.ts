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
import { indexedDbStore, memoryStore } from "./paper-sync-store.ts"

it("keeps typed words when the page dies inside the old 50ms window", async () => {
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
