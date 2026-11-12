import { QueryClient } from "@tanstack/react-query"
import { paperCanvasCommitSchema, type WordPage } from "@workspace/domain"

import { ApiError } from "@/lib/api-error.ts"
import {
  applyReply,
  type Acknowledgement,
  type LocalObservation,
  type PackageDraft,
} from "@/lib/paper-package-ack.ts"
import { runContractCommand } from "@/lib/contract-client.ts"
import {
  draftFromPage,
  pageBlocks,
  type DraftBasis,
  type TextPoint,
  type WritingBlock,
  type WritingDraft,
} from "./canvas-edit.ts"
import { readWordPage } from "./package-read.ts"
import { diffParagraphs } from "./page-diff.ts"

const DATABASE = "opencv-writing"
const TABLE = "pages"
const UNAVAILABLE = "Saved Word documents are unavailable."
const SERVER_NOTES = new Set([
  UNAVAILABLE,
  "This Word document has changed. Read it again before editing.",
])

export type WritingRecord = {
  key: string
  commandId: string
  generation: number
  words: string
  revision: string | null
  idempotencyKey: string
}

export type SaveOutcome = {
  saved: boolean
  words: string
  revision: string | null
  note: string | null
  blocks?: WritingBlock[]
  basis?: DraftBasis
  replace?: WritingDraft
  conflict?: boolean
}

export type SettleClaim = {
  basis: DraftBasis | null
  typed: boolean
  caret?: TextPoint
}

type PageBlock = { id: string; text: string; held?: boolean }

export function pageWords(blocks: readonly { text: string }[]): string {
  return blocks.map((block) => block.text).join("\n")
}

export function savedNote(words: string, outcome: SaveOutcome): string | null {
  if (words === "" && !outcome.saved) return null
  if (outcome.note === UNAVAILABLE) return "Word documents are unavailable."
  if (outcome.note && SERVER_NOTES.has(outcome.note)) return outcome.note
  if (!outcome.saved && outcome.note) return outcome.note
  if (!outcome.saved || outcome.words !== words || outcome.revision === null) {
    return null
  }
  return "Saved"
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
  ownWrites.clear()
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

function missed(words: string): SaveOutcome {
  return { saved: false, words, revision: null, note: null }
}

function serverNote(error: unknown): string | null {
  if (!(error instanceof ApiError) || error.message === "") return null
  if (
    SERVER_NOTES.has(error.message) ||
    error.status === 400 ||
    error.status === 409
  ) {
    return error.message
  }
  return null
}

let commands: QueryClient | null = null

function commandClient() {
  commands ??= new QueryClient()
  return commands
}

async function readPage(docId: string, signal: AbortSignal) {
  return readWordPage("page", docId, signal)
}

function pageText(page: WordPage) {
  return pageWords(pageBlocks(page))
}

function adoptedBlocks(page: WordPage, blocks: readonly PageBlock[]) {
  const next = pageBlocks(page)
  if (next.length !== blocks.length) return undefined
  const same = next.every(
    (block, index) =>
      block.text === blocks[index]?.text &&
      !!block.held === !!blocks[index]?.held
  )
  return same ? next : undefined
}

async function sendPage(
  page: WordPage,
  blocks: readonly PageBlock[],
  caret: TextPoint | null
): Promise<{ revision: string | null; note: string | null }> {
  const diff = diffParagraphs(page, blocks, caret)
  if ("refused" in diff) return { revision: null, note: diff.refused }
  if (diff.ops.length === 0) return { revision: null, note: null }
  const input = paperCanvasCommitSchema.safeParse({
    op: "write",
    batch: { doc: page.doc, basedOn: page.revision, ops: diff.ops },
  })
  if (!input.success)
    return { revision: null, note: input.error.issues[0]?.message ?? null }
  return {
    revision: receiptRevision(
      await runContractCommand(commandClient(), "paper.canvas", input.data, {
        refresh: false,
      })
    ),
    note: null,
  }
}

function receiptRevision(value: unknown) {
  if (!value || typeof value !== "object") return null
  if (!("generation" in value) || value.generation !== "package") return null
  if (!("revision" in value) || typeof value.revision !== "string") return null
  return value.revision
}

const tails = new Map<string, Promise<unknown>>()
const ownWrites = new Map<string, DraftBasis>()

function basisAt(
  docId: string,
  revision: string,
  claimed: DraftBasis | null
): DraftBasis | null {
  const own = ownWrites.get(docId)
  return own && own.revision === revision ? own : claimed
}

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

function recordedBasis(revision: string, words: string): DraftBasis {
  return { revision, words }
}

async function settleOnce(
  docId: string,
  blocks: readonly PageBlock[],
  signal: AbortSignal,
  claim: SettleClaim
): Promise<SaveOutcome> {
  const words = pageWords(blocks)
  if (signal.aborted) return missed(words)
  const committed = await commitWords(docId, words)
  if (committed.local.transaction !== "complete") return missed(words)
  try {
    const page = await readPage(docId, signal)
    if (!page || signal.aborted) return missed(words)
    const seen = pageText(page)
    const basis = basisAt(docId, page.revision, claim.basis)
    const changed = basis ? words !== basis.words : claim.typed
    const serverMoved =
      basis?.revision != null && page.revision !== basis.revision
    if (words === seen && (words !== "" || basis !== null)) {
      return {
        saved: true,
        words,
        revision: page.revision,
        note: null,
        basis: recordedBasis(page.revision, words),
      }
    }
    if (!changed) {
      if (words === "" && seen === "") return missed(words)
      const replacement = draftFromPage(page)
      if (!replacement) return missed(words)
      return {
        saved: false,
        words: seen,
        revision: page.revision,
        note: null,
        replace: replacement,
        basis: recordedBasis(page.revision, seen),
      }
    }
    if (serverMoved) {
      return { saved: false, words, revision: null, note: null, conflict: true }
    }
    const sent = await sendPage(page, blocks, claim.caret ?? null)
    if (sent.note)
      return { saved: false, words, revision: null, note: sent.note }
    if (sent.revision) ownWrites.set(docId, recordedBasis(sent.revision, words))
    if (!sent.revision || signal.aborted) return missed(words)
    const next = await readPage(docId, signal)
    if (!next || next.revision !== sent.revision || pageText(next) !== words) {
      return missed(words)
    }
    const adopted = adoptedBlocks(next, blocks)
    return {
      saved: true,
      words,
      revision: next.revision,
      note: null,
      basis: recordedBasis(next.revision, words),
      ...(adopted ? { blocks: adopted } : {}),
    }
  } catch (error) {
    return { ...missed(words), note: serverNote(error) }
  }
}

export function settlePage(
  docId: string,
  blocks: readonly PageBlock[],
  signal: AbortSignal,
  claim: SettleClaim = { basis: null, typed: true }
): Promise<SaveOutcome> {
  return serial(docId, () => settleOnce(docId, blocks, signal, claim))
}
