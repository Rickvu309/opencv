import { storedHasPending, type Stored } from "@workspace/paper-crdt"

export type Orphan = { readonly tabId: string; readonly stored: Stored }

export type Loaded = { readonly own: Stored | null; readonly orphans: Orphan[] }

export type SyncStore = {
  load(docId: string, tabId: string): Promise<Loaded>
  save(docId: string, tabId: string, stored: Stored): Promise<void>
  remove(docId: string, tabId: string): Promise<void>
  removeDoc(docId: string): Promise<void>
  prune(docId: string, now: number): Promise<void>
  close(): Promise<void>
}

type Record = Stored & { key: string; docId: string; savedAt: number }

const DATABASE = "paper-sync"
const TABLE = "docs"
const ORPHAN_AGE_MS = 5 * 60 * 1000
const STALE_AGE_MS = 30 * 24 * 60 * 60 * 1000

type Seen = { [docId: string]: number }

const SEEN_KEY = "paper-sync-seen"

function seenDocs(): Seen {
  try {
    return JSON.parse(localStorage.getItem(SEEN_KEY) ?? "{}")
  } catch {
    return {}
  }
}

function rememberDocs(seen: Seen) {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify(seen))
  } catch {
    return
  }
}

function recordHasPending(record: Record) {
  try {
    return storedHasPending(record)
  } catch {
    return true
  }
}

const docRange = (docId: string) =>
  IDBKeyRange.bound(`${docId}:`, `${docId}:\uffff`)

export const keyOf = (docId: string, tabId: string) => `${docId}:${tabId}`
export const lockOf = (docId: string, tabId: string) =>
  `paper-sync:${keyOf(docId, tabId)}`

function request<T>(source: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    source.onsuccess = () => resolve(source.result)
    source.onerror = () => reject(source.error)
  })
}

function settled(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onabort = () =>
      reject(transaction.error ?? new Error("IndexedDB transaction aborted"))
  })
}

function openDatabase(
  onGone: () => void,
  databaseName: string
): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const opening = indexedDB.open(databaseName, 1)
    opening.onupgradeneeded = () => {
      opening.result.createObjectStore(TABLE, { keyPath: "key" })
    }
    opening.onsuccess = () => {
      const database = opening.result
      database.onversionchange = () => {
        database.close()
        onGone()
      }
      resolve(database)
    }
    opening.onerror = () => {
      reject(opening.error)
    }
  })
}

export async function heldLocks(): Promise<Set<string> | null> {
  const locks = typeof navigator === "undefined" ? undefined : navigator.locks
  if (!locks?.query) return null
  const state = await locks.query()
  return new Set((state.held ?? []).map((lock) => lock.name ?? ""))
}

export function holdTabLock(docId: string, tabId: string): () => void {
  const locks = typeof navigator === "undefined" ? undefined : navigator.locks
  if (!locks?.request) return () => {}
  let release: () => void = () => {}
  const held = new Promise<void>((resolve) => {
    release = resolve
  })
  void locks.request(lockOf(docId, tabId), () => held)
  return release
}

export function holdNativeTabLock(
  docId: string,
  tabId: string
): Promise<() => void> {
  const locks = typeof navigator === "undefined" ? undefined : navigator.locks
  if (!locks?.request)
    return Promise.reject(new Error("Native tab locks unavailable"))
  return new Promise((resolve, reject) => {
    void locks
      .request(lockOf(docId, tabId), { ifAvailable: true }, async (lock) => {
        if (!lock) {
          reject(new Error("Native tab already held"))
          return
        }
        await new Promise<void>((release) => {
          resolve(release)
        })
      })
      .catch(reject)
  })
}

export function indexedDbStore(native = false): SyncStore {
  let opened: Promise<IDBDatabase> | null = null
  const connection = () => {
    opened ??= openDatabase(
      () => {
        opened = null
      },
      native ? "paper-native-sync-r1" : DATABASE
    )
    return opened
  }
  const table = async (mode: IDBTransactionMode) =>
    (await connection()).transaction(TABLE, mode).objectStore(TABLE)
  return {
    async close() {
      const known = opened
      opened = null
      if (known) (await known.catch(() => null))?.close()
    },
    async load(docId, tabId) {
      const all = (await request(
        (await table("readonly")).getAll(docRange(docId))
      )) as Record[]
      const mine = all.find((record) => record.key === keyOf(docId, tabId))
      const held = await heldLocks()
      if (native && !held)
        throw new Error("Native recovery lock scan unavailable")
      if (
        native &&
        all.some(
          (record) =>
            record.docId !== docId ||
            typeof record.key !== "string" ||
            !record.key.startsWith(`${docId}:`) ||
            record.key.length <= docId.length + 1
        )
      )
        throw new Error("Malformed native recovery retained")
      const now = Date.now()
      const orphans = all
        .filter(
          (record) =>
            record.docId === docId &&
            record.key !== keyOf(docId, tabId) &&
            (held
              ? !held.has(`paper-sync:${record.key}`)
              : now - record.savedAt > ORPHAN_AGE_MS)
        )
        .map((record) => ({
          tabId: record.key.slice(docId.length + 1),
          stored: {
            ...(record.provenance ? { provenance: record.provenance } : {}),
            epoch: record.epoch,
            server: record.server,
            pending: record.pending,
            ...(record.revision === undefined
              ? {}
              : { revision: record.revision }),
          },
        }))
      return { own: mine ?? null, orphans }
    },
    async save(docId, tabId, stored) {
      const record: Record = {
        ...stored,
        key: keyOf(docId, tabId),
        docId,
        savedAt: Date.now(),
      }
      const owned = await table("readwrite")
      owned.put(record)
      await settled(owned.transaction)
    },
    async remove(docId, tabId) {
      await request((await table("readwrite")).delete(keyOf(docId, tabId)))
    },
    async removeDoc(docId) {
      const store = await table("readwrite")
      const keys = await request(store.getAllKeys(docRange(docId)))
      for (const key of keys) await request(store.delete(key))
    },
    async prune(docId, now) {
      if (native) return
      const seen = seenDocs()
      const due = Object.entries(seen).filter(
        ([id, at]) => id !== docId && now - at > STALE_AGE_MS
      )
      seen[docId] = now
      for (const [id] of due) {
        const store = await table("readwrite")
        const records = (await request(store.getAll(docRange(id)))) as Record[]
        let kept = false
        for (const record of records) {
          if (!recordHasPending(record)) {
            await request(store.delete(record.key))
          } else {
            kept = true
          }
        }
        if (!kept) delete seen[id]
      }
      rememberDocs(seen)
    },
  }
}

export function memoryStore(): SyncStore {
  const records = new Map<string, Stored>()
  return {
    async load(docId, tabId) {
      const orphans = [...records]
        .filter(
          ([key]) => key.startsWith(`${docId}:`) && key !== keyOf(docId, tabId)
        )
        .map(([key, stored]) => ({
          tabId: key.slice(docId.length + 1),
          stored,
        }))
      return { own: records.get(keyOf(docId, tabId)) ?? null, orphans }
    },
    async save(docId, tabId, stored) {
      records.set(keyOf(docId, tabId), stored)
    },
    async remove(docId, tabId) {
      records.delete(keyOf(docId, tabId))
    },
    async removeDoc(docId) {
      for (const key of [...records.keys()]) {
        if (key.startsWith(`${docId}:`)) records.delete(key)
      }
    },
    async prune() {},
    async close() {},
  }
}

export function defaultStore(): SyncStore {
  return typeof indexedDB === "undefined" ? memoryStore() : indexedDbStore()
}
