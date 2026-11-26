import "fake-indexeddb/auto"
import * as Y from "yjs"
import {
  canonicalPaper,
  nativeProvenance,
  RICH_NATIVE_WRITER,
} from "@workspace/domain/paper-doc"
import {
  absorbUpdate,
  emptyUpdate,
  knownAfter,
  materializeStored,
  seedStoredYDoc,
  updateSince,
} from "@workspace/paper-crdt"
import { afterEach, expect, it, vi } from "vitest"
import { storedFlowFixture } from "../../../../packages/paper-crdt/src/test/flow-fixture.ts"
import {
  deferred,
  memory,
  sessionHarness,
} from "./paper-sync-native.fixtures.ts"
import { openRichNativePaperSync } from "./paper-native-transport.ts"
import { nativeJournalKey, scanNativeJournals } from "./paper-sync-recovery.ts"
import { requireNativeIdentity } from "./paper-sync-identity.ts"
import { fromBase64, toBase64 } from "./paper-sync-bytes.ts"

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

function quotaStorage(limit: number): Storage {
  const inner = memory()
  const used = () => {
    let total = 0
    for (let at = 0; at < inner.length; at += 1) {
      const key = inner.key(at)!
      total += key.length + (inner.getItem(key)?.length ?? 0)
    }
    return total
  }
  return {
    get length() {
      return inner.length
    },
    clear: () => inner.clear(),
    key: (index) => inner.key(index),
    getItem: (key) => inner.getItem(key),
    removeItem: (key) => inner.removeItem(key),
    setItem(key, value) {
      const before = inner.getItem(key)
      const growth =
        key.length +
        value.length -
        (before === null ? 0 : key.length + before.length)
      if (used() + growth > limit)
        throw new DOMException(
          "The quota has been exceeded.",
          "QuotaExceededError"
        )
      inner.setItem(key, value)
    },
  }
}

function typeInto(doc: Y.Doc, kind: "cv" | "letter", text: string) {
  const visit = (fragment: Y.XmlFragment): boolean => {
    for (const child of fragment.toArray()) {
      if (child instanceof Y.XmlText && child.length) {
        child.insert(child.length, text)
        return true
      }
      if (child instanceof Y.XmlElement && visit(child)) return true
    }
    return false
  }
  if (
    !visit(
      doc.getXmlFragment(
        kind === "cv" ? "private-native-cv-v4-r2" : "document-store"
      )
    )
  )
    throw new Error("No text to type into")
}

function richServer(kind: "cv" | "letter") {
  const document = storedFlowFixture(kind)
  const provenance = nativeProvenance(document)
  const remote = new Y.Doc()
  Y.applyUpdate(remote, seedStoredYDoc(document))
  let revision = 1
  const reply = (since: Uint8Array, stale: boolean) => ({
    provenance,
    epoch: 1,
    revision,
    reset: false,
    stale,
    update: toBase64(updateSince(remote, since)!),
    stateVector: toBase64(Y.encodeStateVector(remote)),
  })
  return {
    provenance,
    remote,
    admitted: () => ({
      epoch: 1,
      revision,
      provenance,
      server: Y.encodeStateAsUpdate(remote),
      pending: emptyUpdate(),
    }),
    answer(input: { update: string; stateVector: string; basedOn?: number }) {
      const update = fromBase64(input.update)
      const stateVector = fromBase64(input.stateVector)
      if (input.basedOn !== undefined && input.basedOn !== revision)
        return reply(stateVector, true)
      if (update.byteLength > 0) {
        const absorbed = absorbUpdate(remote, update, "person")
        if (!absorbed.ok) throw new Error(absorbed.reason)
        if (absorbed.effective) revision += 1
      }
      return reply(knownAfter(stateVector, update)!, false)
    },
    document: () => {
      const read = materializeStored(remote)
      if (!read.ok) throw new Error(read.reason)
      return read.document
    },
  }
}

it.each(["cv", "letter"] as const)(
  "holding a key in a %s through a slow save keeps every keystroke and a bounded journal",
  async (kind) => {
    const h = sessionHarness()
    const server = richServer(kind)
    const identity = requireNativeIdentity({
      ...h.options.identity,
      provenance: server.provenance,
      writer: RICH_NATIVE_WRITER,
    })
    const snapshot = toBase64(server.admitted().server).length
    const journal = quotaStorage(snapshot * 24)
    const gate = deferred()
    let held = true
    h.run.mockImplementation(async (_client, _name, input) => {
      if (held) await gate.promise
      return server.answer(input)
    })
    const sync = openRichNativePaperSync({
      ...h.options,
      identity,
      journal,
      currentIdentity: () => identity,
      readAdmitted: async () => server.admitted(),
    })
    try {
      held = false
      await sync.initialized
      expect(sync.status()).toBe("saved")
      held = true
      const live = sync.client()
      if (!live) throw new Error("Missing rich client")
      typeInto(live.ydoc, kind, "a")
      const flushing = sync.flush()
      const statuses = new Set<string>()
      let largest = 0
      for (let at = 0; at < 100; at += 1) {
        typeInto(live.ydoc, kind, ` ${at}`)
        statuses.add(sync.status())
        largest = Math.max(
          largest,
          scanNativeJournals(journal, identity).find(
            (entry) => entry.tabId === "active"
          )?.states.length ?? 0
        )
      }
      expect([...statuses].filter((status) => status !== "saving")).toEqual([])
      expect(largest).toBe(1)
      const expected = live.document()
      held = false
      gate.release()
      await flushing
      for (let round = 0; round < 3 && live.hasPending(); round += 1)
        await sync.flush()
      expect(sync.status()).toBe("saved")
      expect(canonicalPaper(server.document())).toBe(canonicalPaper(expected!))
      expect(journal.getItem(nativeJournalKey(identity, "active"))).toContain(
        '"entries":[]'
      )
    } finally {
      gate.release()
      await sync.destroy()
    }
  },
  120_000
)

it.each(["cv", "letter"] as const)(
  "a second %s tab receives the first tab's words on its next pull and stays Saved while pulling",
  async (kind) => {
    const h = sessionHarness()
    const server = richServer(kind)
    const identity = requireNativeIdentity({
      ...h.options.identity,
      provenance: server.provenance,
      writer: RICH_NATIVE_WRITER,
    })
    h.run.mockImplementation(async (_client, _name, input) =>
      server.answer(input)
    )
    const open = (tabId: string) =>
      openRichNativePaperSync({
        ...h.options,
        identity,
        tabId,
        journal: memory(),
        currentIdentity: () => identity,
        readAdmitted: async () => server.admitted(),
      })
    const first = open("first")
    const second = open("second")
    try {
      await Promise.all([first.initialized, second.initialized])
      const writer = first.client()
      const reader = second.client()
      if (!writer || !reader) throw new Error("Missing rich client")
      typeInto(writer.ydoc, kind, " from the first tab Việt 😀")
      await first.flush()
      expect(first.status()).toBe("saved")
      const seen: string[] = []
      const stop = second.subscribe(() => seen.push(second.status()))
      const pulling = second.flush()
      expect(second.status()).toBe("saved")
      await pulling
      stop()
      expect(second.status()).toBe("saved")
      expect(canonicalPaper(reader.document()!)).toBe(
        canonicalPaper(writer.document()!)
      )
      expect(seen.filter((status) => status === "stuck")).toEqual([])
    } finally {
      await first.destroy()
      await second.destroy()
    }
  },
  60_000
)

it.each(["cv", "letter"] as const)(
  "simultaneous %s saves retry a stale receipt and keep both tabs and the server canonical",
  async (kind) => {
    const first = sessionHarness()
    const second = sessionHarness()
    const server = richServer(kind)
    const identity = requireNativeIdentity({
      ...first.options.identity,
      provenance: server.provenance,
      writer: RICH_NATIVE_WRITER,
    })
    const sessions = [first, second].map((h, index) => {
      h.run.mockImplementation(async (_query, _name, input) =>
        server.answer(input)
      )
      return openRichNativePaperSync({
        ...h.options,
        tabId: `tab-${index}`,
        identity,
        currentIdentity: () => identity,
        readAdmitted: async () => server.admitted(),
      })
    })
    try {
      await Promise.all(sessions.map((session) => session.initialized))
      for (const [index, session] of sessions.entries()) {
        const client = session.client()
        if (!client) throw new Error("Missing rich client")
        typeInto(client.ydoc, kind, ` simultaneous-tab-${index} Việt 😀`)
      }
      await Promise.all(sessions.map((session) => session.flush()))
      await sessions[0]!.flush()
      const canonical = canonicalPaper(server.document())
      for (const index of [0, 1])
        expect(canonical).toContain(`simultaneous-tab-${index} Việt 😀`)
      for (const session of sessions) {
        expect(canonicalPaper(session.client()?.document())).toBe(canonical)
        expect(session.status()).toBe("saved")
      }
      expect(
        second.run.mock.calls.filter((call) => call[2].basedOn !== undefined)
      ).toHaveLength(2)
    } finally {
      await Promise.all(sessions.map((session) => session.destroy()))
      server.remote.destroy()
    }
  }
)

it("a recovered rich client stays unavailable until its initial local save finishes", async () => {
  const h = sessionHarness()
  const server = richServer("letter")
  const identity = requireNativeIdentity({
    ...h.options.identity,
    provenance: server.provenance,
    writer: RICH_NATIVE_WRITER,
  })
  const started = deferred()
  const gate = deferred()
  h.run.mockImplementation(async (_query, _name, input) => server.answer(input))
  const save = h.store.save.bind(h.store)
  vi.spyOn(h.store, "save").mockImplementation(async (...args) => {
    started.release()
    await gate.promise
    return save(...args)
  })
  const session = openRichNativePaperSync({
    ...h.options,
    identity,
    currentIdentity: () => identity,
    readAdmitted: async () => server.admitted(),
  })
  try {
    await started.promise
    expect(session.client()).toBeNull()
    expect(session.ready()).toBe(false)
    gate.release()
    await session.initialized
    expect(session.client()).not.toBeNull()
    expect(session.ready()).toBe(true)
  } finally {
    gate.release()
    await session.destroy()
    server.remote.destroy()
  }
})

it("a refused rich save retains the mounted document, pending bytes and local recovery while blocking Saved", async () => {
  const h = sessionHarness()
  const server = richServer("letter")
  const identity = requireNativeIdentity({
    ...h.options.identity,
    provenance: server.provenance,
    writer: RICH_NATIVE_WRITER,
  })
  h.run.mockImplementation(async (_query, _name, input) => server.answer(input))
  const session = openRichNativePaperSync({
    ...h.options,
    identity,
    currentIdentity: () => identity,
    readAdmitted: async () => server.admitted(),
  })
  try {
    await session.initialized
    const client = session.client()
    if (!client) throw new Error("Missing rich client")
    typeInto(client.ydoc, "letter", " keep-this-rejected-text")
    const before = client.stored()
    h.run.mockResolvedValue({
      ...h.reply,
      provenance: server.provenance,
      epoch: 2,
      reset: true,
    })
    await session.flush()
    await session.persist()
    expect(session.status()).toBe("stuck")
    expect(session.ready()).toBe(false)
    expect(session.captureSaved()).toBeNull()
    expect(session.client()).toBe(client)
    expect(client.stored()).toEqual(before)
    expect(canonicalPaper(client.document())).toContain(
      "keep-this-rejected-text"
    )
    expect(scanNativeJournals(h.options.journal, identity)[0]?.states).toEqual([
      before,
    ])
  } finally {
    await session.destroy()
    server.remote.destroy()
  }
})
