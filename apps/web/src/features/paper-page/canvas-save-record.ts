import type { LocalObservation } from "@/lib/paper-package-ack.ts"

import type { DraftBasis } from "./canvas-edit.ts"
import type { PageBlock } from "./canvas-save-lines.ts"

const DATABASE = "opencv-writing"
const TABLE = "pages"
export type WritingRecord = {
  key: string
  commandId: string
  generation: number
  words: string
  revision: string | null
  idempotencyKey: string
  sent?: SentRecord[]
}

export type SentRecord = {
  words: string
  bases: string[]
  blocks: PageBlock[]
}

function updateRecord(
  db: IDBDatabase,
  docId: string,
  change: (existing: WritingRecord | undefined) => WritingRecord | null
): Promise<WritingRecord | null> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(TABLE, "readwrite")
    const store = tx.objectStore(TABLE)
    const req = store.get(docId)
    let value: WritingRecord | null = null
    req.onsuccess = () => {
      value = change(req.result as WritingRecord | undefined)
      if (value) store.put(value)
    }
    tx.oncomplete = () => resolve(value)
    tx.onabort = () => reject(tx.error ?? new Error("aborted"))
  })
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const opening = indexedDB.open(DATABASE, 1)
    opening.onupgradeneeded = () => {
      if (!opening.result.objectStoreNames.contains(TABLE)) {
        opening.result.createObjectStore(TABLE, { keyPath: "key" })
      }
    }
    opening.onsuccess = () => resolve(opening.result)
    opening.onerror = () => reject(opening.error)
  })
}

let opened: Promise<IDBDatabase> | null = null

function database() {
  opened ??= openDatabase()
  return opened
}

export async function closeRecordDb() {
  const current = opened
  opened = null
  if (!current) return
  const db = await current.catch(() => null)
  db?.close()
}

function fresh(words: string): WritingRecord {
  const commandId = crypto.randomUUID()
  return {
    key: "",
    commandId,
    generation: 1,
    words,
    revision: null,
    idempotencyKey: commandId,
  }
}

export async function commitWords(
  docId: string,
  words: string
): Promise<{ local: LocalObservation; record: WritingRecord }> {
  if (typeof indexedDB === "undefined") {
    const record = fresh(words)
    return {
      local: { transaction: "aborted", generation: 1, words },
      record,
    }
  }
  try {
    const db = await database()
    const record = await updateRecord(db, docId, (existing) => {
      const commandId = existing?.commandId ?? crypto.randomUUID()
      return {
        key: docId,
        commandId,
        generation:
          existing && existing.words === words
            ? existing.generation
            : (existing?.generation ?? 0) + 1,
        words,
        revision: existing?.revision ?? null,
        idempotencyKey: existing?.idempotencyKey ?? commandId,
        ...(existing?.sent ? { sent: existing.sent } : {}),
      }
    })
    if (!record) throw new Error("not written")
    const generation = record.generation
    return {
      local: { transaction: "complete", generation, words },
      record,
    }
  } catch {
    opened = null
    const record = fresh(words)
    return {
      local: { transaction: "aborted", generation: record.generation, words },
      record,
    }
  }
}

const SENT_KEPT = 8

export function ownSent(
  record: WritingRecord,
  claimed: DraftBasis | null,
  seen: string
): SentRecord | undefined {
  const held = claimed?.revision
  if (!held || !Array.isArray(record.sent)) return undefined
  return record.sent.findLast(
    (item) => item.bases.includes(held) && item.words === seen
  )
}

export async function keepSent(
  docId: string,
  keep: (sent: readonly SentRecord[]) => SentRecord[]
) {
  if (typeof indexedDB === "undefined") return
  try {
    const db = await database()
    await updateRecord(db, docId, (existing) =>
      existing ? { ...existing, sent: keep(existing.sent ?? []) } : null
    )
  } catch {
    opened = null
  }
}

export async function recordSent(docId: string, sent: SentRecord) {
  if (typeof indexedDB === "undefined") return false
  let fresh = false
  try {
    const db = await database()
    await updateRecord(db, docId, (existing) => {
      if (!existing) return null
      const before = existing.sent ?? []
      const same = before.find((item) => item.words === sent.words)
      fresh = !same
      const merged = same
        ? { ...sent, bases: [...new Set([...same.bases, ...sent.bases])] }
        : sent
      return {
        ...existing,
        sent: [
          ...before.filter((item) => item.words !== sent.words),
          merged,
        ].slice(-SENT_KEPT),
      }
    })
  } catch {
    opened = null
  }
  return fresh
}
