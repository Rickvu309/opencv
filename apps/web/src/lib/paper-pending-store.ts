import {
  changeSchema,
  documentSchema,
  type Change,
  type Document,
} from "@workspace/domain/paper-doc"
import { z } from "zod"

export type PendingRecord = {
  docId: string
  writer: string
  doc: Document
  version: number
  pending: Change[]
}

export type PendingStore = {
  writers(docId: string): Promise<string[]>
  load(docId: string, writer: string): Promise<PendingRecord | null>
  put(record: PendingRecord): Promise<void>
  drop(docId: string, writer: string): Promise<void>
  recovered(docId: string): Promise<string[]>
  keepRecovered(docId: string, texts: readonly string[]): Promise<void>
}

const recordSchema = z.object({
  docId: z.string(),
  writer: z.string(),
  doc: documentSchema,
  version: z.int().nonnegative(),
  pending: z.array(changeSchema),
})

const recoveredSchema = z.object({
  docId: z.string(),
  texts: z.array(z.string()),
})

function readRecord(value: unknown): PendingRecord | null {
  const parsed = recordSchema.safeParse(value)
  return parsed.success ? (parsed.data as PendingRecord) : null
}

export function memoryPendingStore(): PendingStore & {
  records(): PendingRecord[]
} {
  const records = new Map<string, PendingRecord>()
  const recovered = new Map<string, string[]>()
  const key = (docId: string, writer: string) => `${docId}\n${writer}`
  return {
    records: () =>
      [...records.values()].map((record) => structuredClone(record)),
    async writers(docId) {
      return [...records.values()]
        .filter((record) => record.docId === docId)
        .map((record) => record.writer)
    },
    async load(docId, writer) {
      const found = records.get(key(docId, writer))
      return found ? structuredClone(found) : null
    },
    async put(record) {
      records.set(key(record.docId, record.writer), structuredClone(record))
    },
    async drop(docId, writer) {
      records.delete(key(docId, writer))
    },
    async recovered(docId) {
      return [...(recovered.get(docId) ?? [])]
    },
    async keepRecovered(docId, texts) {
      if (texts.length) recovered.set(docId, [...texts])
      else recovered.delete(docId)
    },
  }
}

const DB_NAME = "opencv-paper-pending"
const PENDING = "pending"
const RECOVERED = "recovered"
const BY_DOC = "byDoc"

function requestDone<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)
    transaction.onabort = () => reject(transaction.error)
  })
}

function openDatabase(factory: IDBFactory): Promise<IDBDatabase> {
  const request = factory.open(DB_NAME, 1)
  request.onupgradeneeded = () => {
    const db = request.result
    const pending = db.createObjectStore(PENDING, {
      keyPath: ["docId", "writer"],
    })
    pending.createIndex(BY_DOC, "docId")
    db.createObjectStore(RECOVERED, { keyPath: "docId" })
  }
  return requestDone(request)
}

export function indexedDbPendingStore(
  factory: IDBFactory = indexedDB
): PendingStore {
  let opened: Promise<IDBDatabase> | null = null
  const database = () => (opened ??= openDatabase(factory))

  async function read<T>(
    name: string,
    query: (store: IDBObjectStore) => IDBRequest<T>
  ): Promise<T> {
    const db = await database()
    return requestDone(
      query(db.transaction(name, "readonly").objectStore(name))
    )
  }

  async function write(
    name: string,
    change: (store: IDBObjectStore) => void
  ): Promise<void> {
    const db = await database()
    const transaction = db.transaction(name, "readwrite", {
      durability: "strict",
    })
    change(transaction.objectStore(name))
    await transactionDone(transaction)
  }

  return {
    async writers(docId) {
      const rows = await read(PENDING, (store) =>
        store.index(BY_DOC).getAll(docId)
      )
      return rows.flatMap((row) => {
        const record = readRecord(row)
        return record ? [record.writer] : []
      })
    },
    async load(docId, writer) {
      return readRecord(
        await read(PENDING, (store) => store.get([docId, writer]))
      )
    },
    put: (record) => write(PENDING, (store) => store.put(record)),
    drop: (docId, writer) =>
      write(PENDING, (store) => store.delete([docId, writer])),
    async recovered(docId) {
      const parsed = recoveredSchema.safeParse(
        await read(RECOVERED, (store) => store.get(docId))
      )
      return parsed.success ? parsed.data.texts : []
    },
    keepRecovered: (docId, texts) =>
      write(RECOVERED, (store) => {
        if (texts.length) store.put({ docId, texts: [...texts] })
        else store.delete(docId)
      }),
  }
}
