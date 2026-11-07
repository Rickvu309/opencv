import {
  absorbUpdate,
  emptyUpdate,
  loadYDoc,
  mergedUpdate,
  stateVectorOf,
  updateSince,
  type Stored,
} from "@workspace/paper-crdt"
import { z } from "zod"

export const JOURNAL_LIMIT = 8
export const JOURNAL_CHARS = 48_000

export type JournalResult = "kept" | "quota" | "denied"

const recordSchema = z.object({
  entries: z.array(
    z.object({
      seq: z.number().int().nonnegative(),
      update: z.string(),
      basis: z
        .object({
          epoch: z.number().int().nonnegative(),
          server: z.string(),
          revision: z.number().int().nonnegative().optional(),
        })
        .optional(),
    })
  ),
  next: z.number().int().nonnegative(),
  idbThrough: z.number().int().nonnegative(),
  serverThrough: z.number().int().nonnegative(),
})

type Record = z.infer<typeof recordSchema>

export const journalScope = (docId: string, tabId: string) =>
  `${docId}:${tabId}`

export function recoverJournals(storage: Storage, docId: string) {
  const journals: {
    id: string
    seq: number
    updates: Uint8Array[]
    states: Stored[]
  }[] = []
  const prefix = `${keyOf(docId)}:`
  try {
    for (let at = 0; at < storage.length; at += 1) {
      const key = storage.key(at)
      if (!key?.startsWith(prefix)) continue
      const id = key.slice("paper-sync-journal:".length)
      journals.push({
        id,
        seq: journalTip(storage, id),
        updates: journalUpdates(storage, id),
        states: journalStates(storage, id),
      })
    }
  } catch {
    return journals
  }
  return journals
}

const keyOf = (docId: string) => `paper-sync-journal:${docId}`

export function journalStorageKey(docId: string): string {
  return keyOf(docId)
}

const empty = (): Record => ({
  entries: [],
  next: 0,
  idbThrough: 0,
  serverThrough: 0,
})

function toBase64(bytes: Uint8Array): string {
  let text = ""
  for (let at = 0; at < bytes.length; at += 8192) {
    text += String.fromCharCode(...bytes.subarray(at, at + 8192))
  }
  return btoa(text)
}

function fromBase64(text: string): Uint8Array {
  const raw = atob(text)
  const bytes = new Uint8Array(raw.length)
  for (let at = 0; at < raw.length; at += 1) bytes[at] = raw.charCodeAt(at)
  return bytes
}

function isQuota(error: unknown) {
  const name = error instanceof Error ? error.name : ""
  return name === "QuotaExceededError" || name === "NS_ERROR_DOM_QUOTA_REACHED"
}

function parse(raw: string | null): Record | "denied" {
  if (!raw) return empty()
  try {
    const value = recordSchema.safeParse(JSON.parse(raw))
    return value.success ? value.data : empty()
  } catch {
    return empty()
  }
}

function read(storage: Storage, docId: string): Record | "denied" {
  try {
    return parse(storage.getItem(keyOf(docId)))
  } catch {
    return "denied"
  }
}

function write(storage: Storage, docId: string, record: Record): JournalResult {
  try {
    storage.setItem(keyOf(docId), JSON.stringify(record))
    return "kept"
  } catch (error) {
    return isQuota(error) ? "quota" : "denied"
  }
}

function bound(record: Record): Record {
  const chars = JSON.stringify(record).length
  if (record.entries.length <= JOURNAL_LIMIT && chars <= JOURNAL_CHARS)
    return record
  const groups = new Map<number | undefined, Record["entries"]>()
  for (const entry of record.entries) {
    const epoch = entry.basis?.epoch
    groups.set(epoch, [...(groups.get(epoch) ?? []), entry])
  }
  try {
    const entries = [...groups.values()].map((group) => {
      const latest = group[group.length - 1]!
      return {
        ...latest,
        update: toBase64(
          mergedUpdate(group.map((entry) => fromBase64(entry.update)))
        ),
      }
    })
    return { ...record, entries }
  } catch {
    return record
  }
}

function drop(record: Record): Record {
  const through = Math.min(record.idbThrough, record.serverThrough)
  if (through <= 0) return record
  return {
    ...record,
    entries: record.entries.filter((entry) => entry.seq > through),
  }
}

export function appendJournal(
  storage: Storage,
  docId: string,
  update: Uint8Array,
  stored?: Stored
): JournalResult {
  if (update.byteLength === 0) return "kept"
  const current = read(storage, docId)
  if (current === "denied") return "denied"
  const seq = current.next + 1
  const next = bound({
    ...current,
    next: seq,
    entries: [
      ...current.entries,
      {
        seq,
        update: toBase64(update),
        ...(stored
          ? {
              basis: {
                epoch: stored.epoch,
                server: toBase64(stored.server),
                ...(stored.revision === undefined
                  ? {}
                  : { revision: stored.revision }),
              },
            }
          : {}),
      },
    ],
  })
  return write(storage, docId, next)
}

export function journalTip(storage: Storage, docId: string): number {
  const current = read(storage, docId)
  if (current === "denied") return 0
  return current.next
}

export function journalUpdates(storage: Storage, docId: string): Uint8Array[] {
  const current = read(storage, docId)
  if (current === "denied") return []
  const updates: Uint8Array[] = []
  for (const entry of current.entries) {
    try {
      updates.push(fromBase64(entry.update))
    } catch {
      continue
    }
  }
  return updates
}

function journalStates(storage: Storage, docId: string): Stored[] {
  const current = read(storage, docId)
  if (current === "denied") return []
  const states: Stored[] = []
  for (const entry of current.entries) {
    try {
      const basis = entry.basis
      const state = mergeJournal(
        basis
          ? {
              epoch: basis.epoch,
              server: fromBase64(basis.server),
              pending: emptyUpdate(),
              ...(basis.revision === undefined
                ? {}
                : { revision: basis.revision }),
            }
          : null,
        [fromBase64(entry.update)]
      )
      if (state) states.push(state)
    } catch {
      continue
    }
  }
  return states
}

export function noteJournal(
  storage: Storage,
  docId: string,
  kind: "idb" | "server",
  seq: number
): JournalResult {
  if (seq <= 0) return "kept"
  const current = read(storage, docId)
  if (current === "denied") return "denied"
  const next = drop({
    ...current,
    idbThrough:
      kind === "idb" ? Math.max(current.idbThrough, seq) : current.idbThrough,
    serverThrough:
      kind === "server"
        ? Math.max(current.serverThrough, seq)
        : current.serverThrough,
  })
  return write(storage, docId, next)
}

export function mergeJournal(
  stored: Stored | null,
  updates: readonly Uint8Array[]
): Stored | null {
  if (updates.length === 0) return stored
  const server = stored?.server?.byteLength ? stored.server : null
  const doc = loadYDoc(
    server,
    stored?.pending?.byteLength ? [stored.pending] : []
  )
  for (const update of updates) absorbUpdate(doc, update, "journal")
  const pending =
    updateSince(doc, stateVectorOf(loadYDoc(server, []))) ?? emptyUpdate()
  return {
    epoch: stored?.epoch ?? 0,
    server: stored?.server ?? emptyUpdate(),
    pending,
    ...(stored?.revision === undefined ? {} : { revision: stored.revision }),
  }
}
