import type { PaperClient } from "@workspace/paper-crdt"
import { describe, expect, it, vi } from "vitest"

import {
  DOC,
  fakeServer,
  letter,
  open,
  textOf,
  type,
} from "@/test/paper-sync-kit.ts"
import { SYNC_LABEL } from "./paper-sync.ts"
import { memoryStore } from "./paper-sync-store.ts"

const fallback = vi.hoisted(() => ({ receive: false, adopt: false }))

vi.mock("@workspace/paper-crdt", async (importOriginal) => {
  const real = await importOriginal<typeof import("@workspace/paper-crdt")>()
  return {
    ...real,
    openPaperClient: (...args: Parameters<typeof real.openPaperClient>) => {
      const client = real.openPaperClient(...args)
      return new Proxy(client, {
        get(target, key) {
          if (key === "receive") {
            return (...call: Parameters<PaperClient["receive"]>) => {
              const receipt = target.receive(...call)
              return fallback.receive ? { ...receipt, failed: true } : receipt
            }
          }
          if (key === "adopt") {
            return (...call: Parameters<PaperClient["adopt"]>) => {
              const adoption = target.adopt(...call)
              return fallback.adopt ? { ...adoption, failed: true } : adoption
            }
          }
          const value = Reflect.get(target, key, target)
          return typeof value === "function" ? value.bind(target) : value
        },
      })
    },
  }
})

describe("a merge that fell back to keeping blocks beside", () => {
  it("shows Not merged when the receipt says failed", async () => {
    fallback.receive = false
    fallback.adopt = false
    fakeServer(letter(["p1", "Hello"]))
    const sync = await open()
    await vi.advanceTimersByTimeAsync(100)
    expect(sync.status()).toBe("saved")
    fallback.receive = true
    type(sync, "p1", "Hello kept")
    await vi.advanceTimersByTimeAsync(500)
    await vi.waitFor(() => expect(sync.status()).toBe("stuck"))
    expect(SYNC_LABEL[sync.status()]).toBe("Not merged. Your changes are kept")
    expect(textOf(sync, "p1")).toBe("Hello kept")
  })

  it("shows Not merged when adopting another tab's typing fell back", async () => {
    fallback.receive = false
    fallback.adopt = false
    fakeServer(letter(["p1", "Hello"], ["p2", "World"]))
    const store = memoryStore()
    const first = await open({ store, tabId: "tab-one" })
    type(first, "p1", "Hello one")
    await vi.advanceTimersByTimeAsync(100)
    first.destroy()
    const record = (await store.load(DOC, "tab-other")).orphans[0]!.stored
    await store.save(DOC, "tab-two", record)
    fallback.adopt = true
    const next = await open({ store, tabId: "tab-new" })
    await vi.advanceTimersByTimeAsync(3000)
    await vi.waitFor(() => expect(next.status()).toBe("stuck"))
    expect(textOf(next, "p1")).toBe("Hello one")
  })
})
