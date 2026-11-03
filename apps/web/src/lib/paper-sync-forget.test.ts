import "fake-indexeddb/auto"

import { materialize } from "@workspace/paper-crdt"
import { describe, expect, it, vi } from "vitest"
import * as Y from "yjs"

import { ApiError } from "./api-error.ts"
import {
  DOC,
  fakeServer,
  letter,
  open,
  server,
  type,
} from "@/test/paper-sync-kit.ts"
import { indexedDbStore } from "./paper-sync-store.ts"

const DAY_MS = 24 * 60 * 60 * 1000

function refuseWith(code: string) {
  server.run = async () => {
    throw new ApiError(404, code, "Not found")
  }
}

async function ownText() {
  const kept = await ownRecord()
  if (!kept) return null
  const restored = new Y.Doc()
  Y.applyUpdate(restored, kept.server)
  Y.applyUpdate(restored, kept.pending)
  return JSON.stringify(materialize(restored))
}

async function ownRecord() {
  const reader = indexedDbStore()
  const loaded = await reader.load(DOC, "tab-a")
  await reader.close()
  return loaded.own
}

function syncedAfterDeletion() {
  const doc = new Y.Doc()
  doc.getText("t").insert(0, "Hello world")
  doc.getText("t").delete(5, 6)
  const server = Y.encodeStateAsUpdate(doc)
  const pending = Y.encodeStateAsUpdate(doc, Y.encodeStateVector(doc))
  return { doc, server, pending }
}

describe("a letter the server no longer knows", () => {
  it("forgets the saved records on NOT_FOUND with nothing pending and never writes them again", async () => {
    indexedDB.deleteDatabase("paper-sync")
    fakeServer(letter(["p1", "Hello"]))
    const sync = await open({ store: indexedDbStore() })
    await vi.advanceTimersByTimeAsync(100)
    expect(await ownRecord()).not.toBeNull()
    refuseWith("NOT_FOUND")
    sync.poke()
    await vi.advanceTimersByTimeAsync(100)
    expect(sync.status()).toBe("refused")
    expect(await ownRecord()).toBeNull()
    window.dispatchEvent(new Event("pagehide"))
    sync.destroy()
    await vi.advanceTimersByTimeAsync(100)
    expect(await ownRecord()).toBeNull()
  })

  it("keeps the records on a 404 without the NOT_FOUND code", async () => {
    indexedDB.deleteDatabase("paper-sync")
    fakeServer(letter(["p1", "Hello"]))
    const sync = await open({ store: indexedDbStore() })
    await vi.advanceTimersByTimeAsync(100)
    refuseWith("REQUEST_FAILED")
    sync.poke()
    await vi.advanceTimersByTimeAsync(100)
    expect(sync.status()).toBe("refused")
    expect(await ownRecord()).not.toBeNull()
  })

  it("keeps the records and the typing on NOT_FOUND while edits are pending", async () => {
    indexedDB.deleteDatabase("paper-sync")
    fakeServer(letter(["p1", "Hello"]))
    const sync = await open({ store: indexedDbStore() })
    refuseWith("NOT_FOUND")
    type(sync, "p1", "Hello unsent")
    await vi.advanceTimersByTimeAsync(500)
    await vi.waitFor(async () => {
      await vi.advanceTimersByTimeAsync(100)
      expect(sync.status()).toBe("refused")
    })
    expect(await ownText()).toContain("Hello unsent")
  })

  it("saves the typing on this device again after the server answers once more", async () => {
    indexedDB.deleteDatabase("paper-sync")
    const remote = fakeServer(letter(["p1", "Hello"]))
    const answering = server.run
    const sync = await open({ store: indexedDbStore() })
    await vi.advanceTimersByTimeAsync(100)
    refuseWith("NOT_FOUND")
    sync.poke()
    await vi.waitFor(async () => {
      await vi.advanceTimersByTimeAsync(100)
      expect(sync.status()).toBe("refused")
    })
    expect(await ownRecord()).toBeNull()
    server.run = answering
    type(sync, "p1", "Hello back")
    await vi.waitFor(async () => {
      await vi.advanceTimersByTimeAsync(100)
      expect(sync.status()).toBe("saved")
    })
    remote.state.online = false
    type(sync, "p1", "Hello back offline")
    await vi.waitFor(async () => {
      await vi.advanceTimersByTimeAsync(100)
      expect(await ownText()).toContain("Hello back offline")
    })
  })
})

describe("pruning letters not opened for 30 days", () => {
  it("removes a fully synced letter that had a deletion and keeps one with a real pending edit", async () => {
    localStorage.clear()
    indexedDB.deleteDatabase("paper-sync")
    const store = indexedDbStore()
    const synced = syncedAfterDeletion()
    expect(synced.pending.length).toBeGreaterThan(2)
    await store.save("synced-doc", "tab-x", {
      epoch: 1,
      server: synced.server,
      pending: synced.pending,
    })
    const serverVector = Y.encodeStateVector(synced.doc)
    synced.doc.getText("t").insert(0, "Unsent ")
    await store.save("pending-doc", "tab-y", {
      epoch: 1,
      server: synced.server,
      pending: Y.encodeStateAsUpdate(synced.doc, serverVector),
    })
    await store.prune("synced-doc", Date.now())
    await store.prune("pending-doc", Date.now())
    vi.setSystemTime(Date.now() + 31 * DAY_MS)
    await store.prune("fresh-doc", Date.now())
    vi.setSystemTime(Date.now() + 10 * 60 * 1000)
    expect((await store.load("synced-doc", "tab-z")).orphans).toHaveLength(0)
    expect((await store.load("pending-doc", "tab-z")).orphans).toHaveLength(1)
    await store.close()
  })
})
