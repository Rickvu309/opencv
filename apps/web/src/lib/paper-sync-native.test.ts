import {
  document,
  provenance,
  identity,
  stored,
  memory,
  deferred,
  sessionHarness,
} from "./paper-sync-native.fixtures.ts"
import "fake-indexeddb/auto"
import { QueryClient } from "@tanstack/react-query"
import { openPaperClient, writeDocument } from "@workspace/paper-crdt"
import { afterEach, expect, it, vi } from "vitest"
import {
  acknowledgeNativeJournal,
  appendNativeJournal,
  nativeJournalKey,
  scanNativeJournals,
} from "./paper-sync-recovery.ts"
import { nativeRecoveryScope } from "./paper-sync-identity.ts"
import { openNativePaperSync } from "./paper-native-transport.ts"
import * as stores from "./paper-sync-store.ts"
import { toBase64 } from "./paper-sync.ts"
import { indexedDbStore } from "./paper-sync-store.ts"

it("selective native checkpoints retain later input and unrelated tabs", () => {
  const storage = memory()
  const old = appendNativeJournal(storage, identity, "a", stored)
  const newer = appendNativeJournal(storage, identity, "a", stored)
  appendNativeJournal(storage, identity, "b", stored)
  acknowledgeNativeJournal(storage, identity, [old], "idb")
  acknowledgeNativeJournal(storage, identity, [old], "server")
  const scan = scanNativeJournals(storage, identity)
  expect(scan.find((entry) => entry.tabId === "a")?.checkpoints).toEqual([
    newer,
  ])
  expect(scan.find((entry) => entry.tabId === "b")?.states).toHaveLength(1)
})
it("malformed and incompatible journals stay byte-identical after refusal", () => {
  for (const raw of [
    "{broken",
    JSON.stringify({
      next: 1,
      entries: [{ seq: 1, snapshot: {}, idb: false, server: false }],
    }),
  ]) {
    const storage = memory()
    const key = nativeJournalKey(identity, "orphan")
    storage.setItem(key, raw)
    expect(() => scanNativeJournals(storage, identity)).toThrow()
    expect(() =>
      appendNativeJournal(storage, identity, "orphan", stored)
    ).toThrow()
    expect(storage.getItem(key)).toBe(raw)
  }
})
it("an unscannable journal refuses instead of returning partial recovery", () => {
  const storage = memory()
  appendNativeJournal(storage, identity, "a", stored)
  storage.key = () => {
    throw new Error("denied")
  }
  expect(() => scanNativeJournals(storage, identity)).toThrow()
})
it("a changed or missing checkpoint refuses acknowledgement without rewriting bytes", () => {
  const storage = memory()
  const checkpoint = appendNativeJournal(storage, identity, "a", stored)
  const raw = storage.getItem(checkpoint.key)
  expect(() =>
    acknowledgeNativeJournal(
      storage,
      identity,
      [{ ...checkpoint, snapshot: "different" }],
      "idb"
    )
  ).toThrow()
  expect(storage.getItem(checkpoint.key)).toBe(raw)
  storage.removeItem(checkpoint.key)
  expect(() =>
    acknowledgeNativeJournal(storage, identity, [checkpoint], "server")
  ).toThrow()
  expect(storage.getItem(checkpoint.key)).toBeNull()
})
it("native IDB retains provenance without sharing legacy records", async () => {
  vi.stubGlobal("navigator", { locks: { query: async () => ({ held: [] }) } })
  const legacy = indexedDbStore()
  const native = indexedDbStore(true)
  const scope = crypto.randomUUID()
  await native.save(scope, "a", stored)
  expect((await native.load(scope, "b")).orphans[0]?.stored.provenance).toEqual(
    provenance
  )
  expect(await legacy.load(scope, "a")).toEqual({ own: null, orphans: [] })
  await native.removeDoc(scope)
  await native.close()
  await legacy.close()
})
it("Unicode recovery snapshots retain the admitted document", () => {
  const local = openPaperClient(stored, { provenance })
  writeDocument(
    local.ydoc,
    {
      ...document,
      blocks: [
        {
          id: "p1",
          type: "paragraph",
          content: [{ text: "Recovered Việt 😀", underline: true }],
        },
      ],
    },
    "person"
  )
  const storage = memory()
  appendNativeJournal(storage, identity, "lost-tab", local.stored())
  const recovered = scanNativeJournals(storage, identity)[0]?.states[0]
  expect(openPaperClient(recovered, { provenance }).document()).toEqual(
    local.document()
  )
})
it("missing native identity refuses synchronously before storage or transport", () => {
  const readAdmitted = vi.fn(async () => stored)
  expect(() =>
    Reflect.apply(openNativePaperSync, undefined, [
      {
        identity: null,
        currentIdentity: () => identity,
        readAdmitted,
        queryClient: new QueryClient(),
        journal: memory(),
      },
    ])
  ).toThrow()
  expect(readAdmitted).not.toHaveBeenCalled()
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})
it("a fast receipt cannot show Saved before the current local completion", async () => {
  const h = sessionHarness()
  const sync = openNativePaperSync(h.options)
  await sync.initialized
  expect(sync.status()).toBe("saved")
  const gate = deferred()
  const original = h.store.save.bind(h.store)
  h.store.save = async (...args) => {
    await gate.promise
    await original(...args)
  }
  const live = sync.client()
  if (!live) throw new Error("Missing admitted client")
  writeDocument(
    live.ydoc,
    {
      ...document,
      blocks: [
        {
          id: "p1",
          type: "paragraph",
          content: [{ text: "Held Việt 😀", underline: true }],
        },
      ],
    },
    "person"
  )
  const flushing = sync.flush()
  await Promise.resolve()
  expect(sync.status()).not.toBe("saved")
  gate.release()
  await flushing
  expect(sync.status()).toBe("saved")
  sync.destroy()
})
it("a delayed old receipt and storage completion never cover later typing", async () => {
  const h = sessionHarness()
  const sync = openNativePaperSync(h.options)
  await sync.initialized
  const gate = deferred()
  const next = deferred()
  const nextStarted = deferred()
  h.run.mockImplementationOnce(async () => {
    await gate.promise
    return h.reply
  })
  h.run.mockImplementationOnce(async () => {
    nextStarted.release()
    await next.promise
    return h.reply
  })
  const live = sync.client()
  if (!live) throw new Error("Missing admitted client")
  const type = (text: string) =>
    writeDocument(
      live.ydoc,
      {
        ...document,
        blocks: [
          { id: "p1", type: "paragraph", content: [{ text, underline: true }] },
        ],
      },
      "person"
    )
  type("First")
  const flushing = sync.flush()
  type("Later Việt 😀")
  gate.release()
  await nextStarted.promise
  expect(sync.status()).not.toBe("saved")
  expect(
    scanNativeJournals(h.options.journal, identity).flatMap(
      (entry) => entry.states
    )
  ).not.toHaveLength(0)
  next.release()
  await flushing
  expect(sync.status()).toBe("saved")
  sync.destroy()
})
it("an older local completion cannot credit input awaiting its own transaction", async () => {
  const h = sessionHarness()
  const sync = openNativePaperSync(h.options)
  await sync.initialized
  const first = deferred()
  const second = deferred()
  const firstStarted = deferred()
  const secondStarted = deferred()
  const original = h.store.save.bind(h.store)
  let writes = 0
  h.store.save = async (...args) => {
    writes += 1
    if (writes === 1) {
      firstStarted.release()
      await first.promise
    } else {
      secondStarted.release()
      await second.promise
    }
    await original(...args)
  }
  const live = sync.client()
  if (!live) throw new Error("Missing admitted client")
  const type = (text: string) =>
    writeDocument(
      live.ydoc,
      {
        ...document,
        blocks: [
          { id: "p1", type: "paragraph", content: [{ text, underline: true }] },
        ],
      },
      "person"
    )
  type("Older transaction")
  await firstStarted.promise
  type("Newer transaction Việt 😀")
  const flushing = sync.flush()
  await Promise.resolve()
  first.release()
  await secondStarted.promise
  expect(sync.status()).not.toBe("saved")
  expect(
    scanNativeJournals(h.options.journal, identity).flatMap(
      (entry) => entry.states
    )
  ).not.toHaveLength(0)
  second.release()
  await flushing
  expect(sync.status()).toBe("saved")
  await sync.destroy()
})
it("bootstraps authoritative bytes after a qualified owner read instead of reseeding visible text", async () => {
  const h = sessionHarness()
  const fetch = vi.fn().mockResolvedValue(
    Response.json({
      ok: true,
      data: {
        id: identity.docId,
        name: "Letter",
        kind: "letter",
        templateId: null,
        status: "draft",
        paper: document,
        nativeBasis: {
          provenance,
          epoch: 1,
          revision: 1,
          digest: "a".repeat(64),
        },
        contentVersion: 1,
        checks: [],
        pageChoice: "unset",
        isFavorite: false,
        sourceFileId: null,
        createdAt: "2026-11-01T00:00:00.000Z",
        updatedAt: "2026-11-01T00:00:00.000Z",
      },
    })
  )
  vi.stubGlobal("fetch", fetch)
  h.run.mockResolvedValueOnce({
    ...h.reply,
    reset: true,
    update: toBase64(stored.server),
  })
  const sync = openNativePaperSync({
    identity,
    currentIdentity: () => identity,
    queryClient: h.options.queryClient,
    journal: h.options.journal,
    store: h.store,
    run: h.run,
    tabId: "active",
  })
  await sync.initialized
  expect(sync.status()).toBe("saved")
  expect(sync.client()?.document()).toEqual(document)
  expect(h.run.mock.calls[0]?.[2]).toEqual({
    docId: identity.docId,
    writer: identity.writer,
    provenance,
    epoch: 0,
    update: "",
    stateVector: "",
  })
  expect(fetch).toHaveBeenCalledTimes(1)
  const init = fetch.mock.calls[0]?.[1]
  expect(init.credentials).toBe("include")
  expect(JSON.parse(init.headers.get("x-paper-writer"))).toEqual(
    identity.writer
  )
  await sync.destroy()
})
it("owner changes detach a delayed receipt and hide the previous client", async () => {
  const h = sessionHarness()
  const sync = openNativePaperSync(h.options)
  await sync.initialized
  const gate = deferred()
  h.run.mockImplementationOnce(async () => {
    await gate.promise
    return h.reply
  })
  const flushing = sync.flush()
  h.changeOwner()
  gate.release()
  await flushing
  expect(sync.client()).toBeNull()
  expect(sync.ready()).toBe(false)
  expect(sync.status()).toBe("refused")
})
it("a changed session refuses its old handle while keeping the owner's recovery scope", async () => {
  const h = sessionHarness()
  const sync = openNativePaperSync(h.options)
  await sync.initialized
  h.changeSession()
  expect(sync.client()).toBeNull()
  expect(sync.status()).toBe("refused")
  expect(nativeRecoveryScope({ ...identity, sessionId: "next-session" })).toBe(
    nativeRecoveryScope(identity)
  )
})
it("native IDB refuses unavailable lock scans while legacy load remains compatible", async () => {
  vi.stubGlobal("navigator", {})
  const native = indexedDbStore(true)
  const legacy = indexedDbStore()
  const scope = crypto.randomUUID()
  await native.save(scope, "orphan", stored)
  await expect(native.load(scope, "active")).rejects.toThrow("lock scan")
  expect(await legacy.load(scope, "active")).toEqual({ own: null, orphans: [] })
  await native.close()
  await legacy.close()
})
it("a disappearing journal fails closed without rewriting its bytes", () => {
  const storage = memory()
  const checkpoint = appendNativeJournal(storage, identity, "orphan", stored)
  const raw = storage.getItem(checkpoint.key)
  const get = storage.getItem
  storage.getItem = () => null
  expect(() => scanNativeJournals(storage, identity)).toThrow("disappeared")
  expect(get(checkpoint.key)).toBe(raw)
})
it("a compatible orphan is persisted before its old IndexedDB copy is removed", async () => {
  const h = sessionHarness()
  const local = openPaperClient(stored, { provenance })
  writeDocument(
    local.ydoc,
    {
      ...document,
      blocks: [
        {
          id: "p1",
          type: "paragraph",
          content: [{ text: "Orphan Việt 😀", underline: true }],
        },
      ],
    },
    "person"
  )
  const scope = nativeRecoveryScope(identity)
  await h.store.save(scope, "orphan", local.stored())
  const original = h.store.remove.bind(h.store)
  h.store.remove = async (...args) => {
    const own = (await h.store.load(scope, "active")).own
    expect(own).not.toBeNull()
    expect(openPaperClient(own, { provenance }).document()).toEqual(
      local.document()
    )
    await original(...args)
  }
  const sync = openNativePaperSync(h.options)
  await sync.initialized
  expect(sync.client()?.document()).toEqual(local.document())
  expect((await h.store.load(scope, "active")).orphans).toHaveLength(0)
  sync.destroy()
})
it("an incompatible orphan remains untouched and blocks readiness", async () => {
  const h = sessionHarness()
  const scope = nativeRecoveryScope(identity)
  const incompatible = { ...stored, provenance: undefined }
  await h.store.save(scope, "orphan", incompatible)
  const remove = vi.spyOn(h.store, "remove")
  const sync = openNativePaperSync(h.options)
  await sync.initialized
  expect(sync.ready()).toBe(false)
  expect(sync.status()).toBe("stuck")
  expect(remove).not.toHaveBeenCalled()
  expect((await h.store.load(scope, "active")).orphans[0]?.stored).toEqual(
    incompatible
  )
  sync.destroy()
})
it("a held tab's orphan is neither adopted nor removed", async () => {
  const h = sessionHarness()
  const scope = nativeRecoveryScope(identity)
  await h.store.save(scope, "held", stored)
  vi.mocked(stores.heldLocks).mockResolvedValue(
    new Set([stores.lockOf(scope, "held")])
  )
  const remove = vi.spyOn(h.store, "remove")
  const sync = openNativePaperSync(h.options)
  await sync.initialized
  expect(remove).not.toHaveBeenCalled()
  expect(stores.holdNativeTabLock).not.toHaveBeenCalledWith(scope, "held")
  expect((await h.store.load(scope, "active")).orphans).toHaveLength(1)
  sync.destroy()
})
it("a failed local transaction retains recovery even after the server accepts", async () => {
  const h = sessionHarness()
  const sync = openNativePaperSync(h.options)
  await sync.initialized
  h.store.save = async () => {
    throw new Error("transaction aborted")
  }
  const live = sync.client()
  if (!live) throw new Error("Missing admitted client")
  writeDocument(
    live.ydoc,
    {
      ...document,
      blocks: [
        {
          id: "p1",
          type: "paragraph",
          content: [{ text: "Retain after abort", underline: true }],
        },
      ],
    },
    "person"
  )
  await sync.flush()
  expect(sync.status()).toBe("local")
  expect(
    scanNativeJournals(h.options.journal, identity).flatMap(
      (entry) => entry.states
    )
  ).not.toHaveLength(0)
  sync.destroy()
})
it("a tab acquired during orphan recovery refuses without removing its copy", async () => {
  const h = sessionHarness()
  const scope = nativeRecoveryScope(identity)
  await h.store.save(scope, "race", stored)
  vi.mocked(stores.holdNativeTabLock).mockImplementation(
    async (_scope, tabId) => {
      if (tabId === "race") throw new Error("Native tab already held")
      return () => {}
    }
  )
  const remove = vi.spyOn(h.store, "remove")
  const sync = openNativePaperSync(h.options)
  await sync.initialized
  expect(sync.status()).toBe("stuck")
  expect(sync.ready()).toBe(false)
  expect(remove).not.toHaveBeenCalled()
  expect((await h.store.load(scope, "active")).orphans).toHaveLength(1)
  sync.destroy()
})
it("re-reads an orphan after acquiring its lock instead of deleting newer words", async () => {
  const h = sessionHarness()
  const scope = nativeRecoveryScope(identity)
  const local = openPaperClient(stored, { provenance })
  await h.store.save(scope, "race", local.stored())
  writeDocument(
    local.ydoc,
    {
      ...document,
      blocks: [
        {
          id: "p1",
          type: "paragraph",
          content: [{ text: "Latest Việt 😀", underline: true }],
        },
      ],
    },
    "person"
  )
  vi.mocked(stores.holdNativeTabLock).mockImplementation(
    async (_scope, tabId) => {
      if (tabId === "race") await h.store.save(scope, "race", local.stored())
      return () => {}
    }
  )
  const sync = openNativePaperSync(h.options)
  await sync.initialized
  expect(sync.client()?.document()).toEqual(local.document())
  expect((await h.store.load(scope, "active")).orphans).toHaveLength(0)
  await sync.destroy()
})
it("retains orphan ownership through an offline retry and releases it at shutdown", async () => {
  const h = sessionHarness()
  const release = vi.fn()
  vi.mocked(stores.holdNativeTabLock).mockResolvedValue(release)
  appendNativeJournal(h.options.journal, identity, "orphan", stored)
  h.run.mockRejectedValueOnce(new Error("offline"))
  const sync = openNativePaperSync(h.options)
  await sync.initialized
  expect(sync.status()).toBe("offline")
  expect(release).not.toHaveBeenCalled()
  await sync.flush()
  expect(sync.status()).toBe("saved")
  expect(release).not.toHaveBeenCalled()
  await sync.destroy()
  expect(release).toHaveBeenCalledTimes(2)
})
it("retains tab ownership until an already-started local transaction settles", async () => {
  const h = sessionHarness()
  const release = vi.fn()
  vi.mocked(stores.holdNativeTabLock).mockResolvedValue(release)
  const sync = openNativePaperSync(h.options)
  await sync.initialized
  const gate = deferred()
  const started = deferred()
  const save = h.store.save.bind(h.store)
  h.store.save = async (...args) => {
    started.release()
    await gate.promise
    await save(...args)
  }
  const live = sync.client()
  if (!live) throw new Error("Missing client")
  writeDocument(
    live.ydoc,
    {
      ...document,
      blocks: [
        {
          id: "p1",
          type: "paragraph",
          content: [{ text: "Closing Việt", underline: true }],
        },
      ],
    },
    "person"
  )
  await started.promise
  const closing = sync.destroy()
  expect(sync.client()).toBeNull()
  expect(release).not.toHaveBeenCalled()
  gate.release()
  await closing
  expect(release).toHaveBeenCalledTimes(1)
})
it("sends the requested newer generation after a delayed exchange", async () => {
  const h = sessionHarness()
  const sync = openNativePaperSync(h.options)
  await sync.initialized
  const gate = deferred()
  h.run.mockImplementationOnce(async () => {
    await gate.promise
    return h.reply
  })
  const live = sync.client()
  if (!live) throw new Error("Missing client")
  const type = (text: string) =>
    writeDocument(
      live.ydoc,
      {
        ...document,
        blocks: [
          { id: "p1", type: "paragraph", content: [{ text, underline: true }] },
        ],
      },
      "person"
    )
  type("First")
  const first = sync.flush()
  type("Newer Việt 😀")
  const second = sync.flush()
  gate.release()
  await Promise.all([first, second])
  expect(h.run).toHaveBeenCalledTimes(3)
  expect(sync.status()).toBe("saved")
  await sync.destroy()
})
