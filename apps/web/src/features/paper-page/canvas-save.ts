import {
  paperPackageEditResultSchema,
  paperPackageReadSchema,
} from "@workspace/domain"

import { apiFetch } from "@/lib/api.ts"
import { unwrapData, type SuccessBody } from "@/lib/api-envelope.ts"
import {
  applyReply,
  draftFromWrite,
  type Acknowledgement,
  type LocalObservation,
  type PackageDraft,
} from "@/lib/paper-package-ack.ts"
import { endpoints } from "@/lib/requests.ts"

const DATABASE = "opencv-writing"
const TABLE = "pages"
const CARRIERS = new Set([
  "OPAQUE_OR_SECTION_BOUNDARY",
  "UNSUPPORTED_TARGET_PROPERTY",
])

export type WritingRecord = {
  key: string
  commandId: string
  generation: number
  words: string
  packageDocId: string | null
  revision: string | null
  idempotencyKey: string
}

export type SaveOutcome = {
  saved: boolean
  words: string
}

export function pageWords(blocks: readonly { text: string }[]): string {
  return blocks.map((block) => block.text).join("\n")
}

export function wordsFromRegions(
  regions: readonly { text: string; reason?: { code: string } }[]
): string {
  return regions
    .filter((region) => !CARRIERS.has(region.reason?.code ?? ""))
    .map((region) => region.text)
    .join("\n")
}

export function decideSave(
  draft: PackageDraft,
  local: LocalObservation | null,
  reply: Acknowledgement
): PackageDraft {
  return applyReply(draft, local, reply)
}

function readRecord(
  db: IDBDatabase,
  docId: string
): Promise<WritingRecord | undefined> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(TABLE, "readonly")
    const req = tx.objectStore(TABLE).get(docId)
    let value: WritingRecord | undefined
    req.onsuccess = () => {
      value = req.result as WritingRecord | undefined
    }
    tx.oncomplete = () => resolve(value)
    tx.onabort = () => reject(tx.error ?? new Error("aborted"))
  })
}

function writeRecord(db: IDBDatabase, record: WritingRecord): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(TABLE, "readwrite")
    tx.objectStore(TABLE).put(record)
    tx.oncomplete = () => resolve()
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

export async function closeWritingDb() {
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
    packageDocId: null,
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
    const existing = await readRecord(db, docId)
    const commandId = existing?.commandId ?? crypto.randomUUID()
    const generation =
      existing && existing.words === words
        ? existing.generation
        : (existing?.generation ?? 0) + 1
    const record: WritingRecord = {
      key: docId,
      commandId,
      generation,
      words,
      packageDocId: existing?.packageDocId ?? null,
      revision: existing?.revision ?? null,
      idempotencyKey: existing?.idempotencyKey ?? commandId,
    }
    await writeRecord(db, record)
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

export async function rememberPackage(
  docId: string,
  packageDocId: string,
  revision: string
): Promise<void> {
  if (typeof indexedDB === "undefined") return
  const db = await database()
  const existing = await readRecord(db, docId)
  if (!existing) return
  await writeRecord(db, { ...existing, packageDocId, revision })
}

function draftOf(record: WritingRecord): PackageDraft {
  return draftFromWrite({
    commandId: record.commandId,
    generation: record.generation,
    words: record.words,
  })
}

function refusal(draft: PackageDraft): Acknowledgement {
  return {
    kind: "refusal",
    commandId: draft.commandId,
    generation: draft.generation,
  }
}

async function postJson(path: string, body: unknown, signal: AbortSignal) {
  return unwrapData(
    await apiFetch<SuccessBody<unknown>>(path, {
      method: "POST",
      body: JSON.stringify(body),
      signal,
    })
  )
}

async function mint(key: string, signal: AbortSignal) {
  const data = await postJson(
    endpoints.catalogCommand("paper.canvas"),
    { input: { op: "mint" }, idempotencyKey: key },
    signal
  )
  if (!data || typeof data !== "object") return null
  const record = data as Record<string, unknown>
  const parsed = paperPackageEditResultSchema.safeParse({
    generation: record.generation,
    docId: record.docId,
    revision: record.revision,
    name: record.name,
    kind: record.kind,
    packageHash: record.packageHash,
    byteSize: record.byteSize,
    incarnation: record.incarnation,
    restore: record.restore ?? null,
  })
  return parsed.success ? parsed.data : null
}

async function readPackage(
  docId: string,
  revision: string,
  signal: AbortSignal
) {
  const data = await postJson(
    endpoints.catalogRead("paper.read"),
    { docId, at: revision },
    signal
  )
  const parsed = paperPackageReadSchema.safeParse(data)
  if (!parsed.success) return null
  return wordsFromRegions(
    parsed.data.regions.map((region) =>
      region.kind === "locked"
        ? { text: region.text, reason: region.reason }
        : { text: region.text }
    )
  )
}

const tails = new Map<string, Promise<unknown>>()

function serial<T>(docId: string, job: () => Promise<T>): Promise<T> {
  const previous = tails.get(docId) ?? Promise.resolve()
  const run = previous.then(job, job)
  tails.set(
    docId,
    run.then(
      () => undefined,
      () => undefined
    )
  )
  return run
}

async function settleOnce(
  docId: string,
  words: string,
  signal: AbortSignal
): Promise<SaveOutcome> {
  if (signal.aborted) return { saved: false, words }
  const committed = await commitWords(docId, words)
  const draft = draftOf(committed.record)
  if (committed.local.transaction !== "complete") {
    return { saved: false, words: draft.words }
  }
  try {
    let packageDocId = committed.record.packageDocId
    let revision = committed.record.revision
    if (!packageDocId || !revision) {
      const minted = await mint(committed.record.idempotencyKey, signal)
      if (!minted) {
        const decided = decideSave(draft, committed.local, refusal(draft))
        return { saved: decided.saved, words: decided.words }
      }
      packageDocId = minted.docId
      revision = minted.revision
      await rememberPackage(docId, packageDocId, revision)
    }
    if (signal.aborted) return { saved: false, words: draft.words }
    const read = await readPackage(packageDocId, revision, signal)
    if (read === null) {
      const decided = decideSave(draft, committed.local, refusal(draft))
      return { saved: decided.saved, words: decided.words }
    }
    const decided = decideSave(draft, committed.local, {
      kind: "receipt",
      receipt: {
        commandId: draft.commandId,
        generation: draft.generation,
        words: read,
      },
    })
    return { saved: decided.saved, words: decided.words }
  } catch {
    const decided = decideSave(draft, committed.local, refusal(draft))
    return { saved: decided.saved, words: decided.words }
  }
}

export function settlePage(
  docId: string,
  words: string,
  signal: AbortSignal
): Promise<SaveOutcome> {
  return serial(docId, () => settleOnce(docId, words, signal))
}
