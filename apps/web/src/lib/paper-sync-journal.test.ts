import { nativePaperDocumentSchema, nativeProvenance } from "@workspace/domain"
import { loadYDoc } from "@workspace/paper-crdt"
import { expect, it } from "vitest"
import * as Y from "yjs"

import {
  JOURNAL_LIMIT,
  appendJournal,
  journalStorageKey,
  journalScope,
  recoverJournals,
  journalUpdates,
  mergeJournal,
  noteJournal,
} from "./paper-sync-journal.ts"

function memory(): Storage {
  const kept = new Map<string, string>()
  return {
    get length() {
      return kept.size
    },
    clear() {
      kept.clear()
    },
    getItem(key: string) {
      return kept.get(key) ?? null
    },
    key(index: number) {
      return [...kept.keys()][index] ?? null
    },
    removeItem(key: string) {
      kept.delete(key)
    },
    setItem(key: string, value: string) {
      kept.set(key, value)
    },
  }
}

function named(name: string) {
  const error = new Error(name)
  error.name = name
  return error
}

function textUpdate(text: string) {
  const doc = new Y.Doc()
  doc.getText("t").insert(0, text)
  return Y.encodeStateAsUpdate(doc)
}

function readText(stored: NonNullable<ReturnType<typeof mergeJournal>>) {
  const doc = loadYDoc(stored.server, [stored.pending])
  return doc.getText("t").toString()
}

it("keeps the previous journal when storage quota is exceeded", () => {
  const kept = new Map<string, string>()
  let writes = 0
  const storage = memory()
  storage.setItem = (key: string, value: string) => {
    writes += 1
    if (writes > 1) throw named("QuotaExceededError")
    kept.set(key, value)
  }
  storage.getItem = (key: string) => kept.get(key) ?? null
  const first = textUpdate("one")
  expect(appendJournal(storage, "doc", first)).toBe("kept")
  expect(appendJournal(storage, "doc", textUpdate("two"))).toBe("quota")
  expect(journalUpdates(storage, "doc")).toEqual([first])
})

it("reports denied storage without dropping a stored journal", () => {
  const storage = memory()
  const first = textUpdate("kept")
  expect(appendJournal(storage, "doc", first)).toBe("kept")
  storage.setItem = () => {
    throw named("SecurityError")
  }
  expect(appendJournal(storage, "doc", textUpdate("next"))).toBe("denied")
  expect(journalUpdates(storage, "doc")).toEqual([first])
  storage.getItem = () => {
    throw named("SecurityError")
  }
  expect(appendJournal(storage, "doc", textUpdate("later"))).toBe("denied")
})

it("compacts a long journal into one update and keeps the words", () => {
  const storage = memory()
  const doc = new Y.Doc()
  const text = doc.getText("t")
  let written = ""
  for (let at = 0; at <= JOURNAL_LIMIT; at += 1) {
    written += String(at)
    text.insert(text.length, String(at))
    expect(appendJournal(storage, "doc", Y.encodeStateAsUpdate(doc))).toBe(
      "kept"
    )
  }
  const updates = journalUpdates(storage, "doc")
  expect(updates.length).toBe(1)
  const merged = mergeJournal(null, updates)
  expect(merged).not.toBeNull()
  expect(readText(merged!)).toBe(written)
})

it("merges a journal update that IndexedDB already holds", () => {
  const update = textUpdate("same")
  const once = mergeJournal(null, [update])
  const twice = mergeJournal(once, [update])
  expect(twice).not.toBeNull()
  expect(readText(twice!)).toBe("same")
})

it("compacts each epoch separately and preserves its recovery basis", () => {
  const storage = memory()
  const id = journalScope("doc", "tab")
  for (const epoch of [1, 2]) {
    const doc = new Y.Doc()
    doc.getText("t").insert(0, `base ${epoch}`)
    const server = Y.encodeStateAsUpdate(doc)
    for (let at = 0; at < JOURNAL_LIMIT; at += 1) {
      doc.getText("t").insert(doc.getText("t").length, ".")
      appendJournal(storage, id, Y.encodeStateAsUpdate(doc), {
        epoch,
        server,
        pending: Y.encodeStateAsUpdate(doc),
      })
    }
  }
  const states = recoverJournals(storage, "doc")[0]!.states
  expect(new Set(states.map(({ epoch }) => epoch))).toEqual(new Set([1, 2]))
  for (const state of states) {
    expect(readText(state)).toMatch(new RegExp(`^base ${state.epoch}\\.+$`))
  }
})

it("drops an entry only after both durability marks", () => {
  const storage = memory()
  appendJournal(storage, "doc", textUpdate("word"))
  expect(noteJournal(storage, "doc", "idb", 1)).toBe("kept")
  expect(journalUpdates(storage, "doc").length).toBe(1)
  expect(noteJournal(storage, "doc", "server", 1)).toBe("kept")
  expect(journalUpdates(storage, "doc")).toEqual([])
  expect(storage.getItem(journalStorageKey("doc"))).toContain('"entries":[]')
})

it("keeps forty successive input updates", () => {
  const storage = memory()
  const doc = new Y.Doc()
  const text = doc.getText("t")
  for (let at = 0; at < 40; at += 1) {
    text.insert(text.length, "a")
    expect(appendJournal(storage, "doc", Y.encodeStateAsUpdate(doc))).toBe(
      "kept"
    )
  }
  const merged = mergeJournal(null, journalUpdates(storage, "doc"))
  expect(readText(merged!)).toBe("a".repeat(40))
})

it("retains a server receipt until IndexedDB also completes", () => {
  const storage = memory()
  appendJournal(storage, "doc", textUpdate("word"))
  noteJournal(storage, "doc", "server", 1)
  expect(journalUpdates(storage, "doc")).toHaveLength(1)
  noteJournal(storage, "doc", "idb", 1)
  expect(journalUpdates(storage, "doc")).toEqual([])
})

it("keeps independent journals for two tabs typing the same document", () => {
  const storage = memory()
  const a = journalScope("doc", "tab-a")
  const b = journalScope("doc", "tab-b")
  appendJournal(storage, a, textUpdate("A"))
  appendJournal(storage, b, textUpdate("B"))
  expect(recoverJournals(storage, "doc")).toHaveLength(2)
  noteJournal(storage, a, "idb", 1)
  noteJournal(storage, a, "server", 1)
  expect(journalUpdates(storage, a)).toEqual([])
  expect(readText(mergeJournal(null, journalUpdates(storage, b))!)).toBe("B")
})

it("keeps newer input while an earlier receipt arrives", () => {
  const storage = memory()
  const doc = new Y.Doc()
  doc.getText("t").insert(0, "first")
  appendJournal(storage, "doc", Y.encodeStateAsUpdate(doc))
  doc.getText("t").insert(5, " second")
  appendJournal(storage, "doc", Y.encodeStateAsUpdate(doc))
  noteJournal(storage, "doc", "server", 1)
  noteJournal(storage, "doc", "idb", 1)
  expect(readText(mergeJournal(null, journalUpdates(storage, "doc"))!)).toBe(
    "first second"
  )
})

it("retains unreadable and future journal bytes and refuses completion", () => {
  for (const raw of [
    "{broken",
    JSON.stringify({
      entries: [],
      next: 0,
      idbThrough: 0,
      serverThrough: 0,
      futureSchema: 2,
    }),
  ]) {
    const storage = memory()
    const id = journalScope("doc", "tab")
    storage.setItem(journalStorageKey(id), raw)
    expect(appendJournal(storage, id, textUpdate("new"))).toBe("denied")
    expect(noteJournal(storage, id, "idb", 1)).toBe("denied")
    expect(storage.getItem(journalStorageKey(id))).toBe(raw)
    expect(recoverJournals(storage, "doc")[0]?.readable).toBe(false)
  }
})

it("keeps native provenance with the full local basis", () => {
  const storage = memory()
  const provenance = nativeProvenance(
    nativePaperDocumentSchema.parse({
      version: 4,
      schemaRevision: 1,
      kind: "letter",
      blocks: [],
      clashes: [],
    })
  )
  const server = new Y.Doc()
  server.getText("t").insert(0, "before")
  const client = new Y.Doc()
  Y.applyUpdate(client, Y.encodeStateAsUpdate(server))
  client.getText("t").insert(6, " underlined")
  const update = Y.encodeStateAsUpdate(client, Y.encodeStateVector(server))
  const stored = {
    epoch: 2,
    revision: 7,
    provenance,
    server: Y.encodeStateAsUpdate(server),
    pending: update,
  }
  const id = journalScope("native-v4-r1:doc", "tab")
  expect(appendJournal(storage, id, update, stored)).toBe("kept")
  const recovered = recoverJournals(storage, "native-v4-r1:doc")[0]!
  expect(recovered.readable).toBe(true)
  expect(recovered.states[0]?.provenance).toEqual(provenance)
  expect(recovered.states[0]?.epoch).toBe(2)
  expect(recovered.states[0]?.revision).toBe(7)
  expect(readText(recovered.states[0]!)).toBe("before underlined")
})
