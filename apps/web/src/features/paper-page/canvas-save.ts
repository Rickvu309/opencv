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
import {
  lineUnits,
  stillRefused,
  withLine,
  withoutRefused,
  type LineRefusal,
  type PageBlock,
} from "./canvas-save-lines.ts"

const DATABASE = "opencv-writing"
const TABLE = "pages"
const SERVER_NOTES = new Set([
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
  refusedLines?: LineRefusal[]
  pageRefusal?: string | null
}

export type SettleClaim = {
  basis: DraftBasis | null
  typed: boolean
  caret?: TextPoint
  refused?: readonly LineRefusal[]
}

export const SIGNED_OUT = "You are signed out."

const PAGE_REASONS = new Map<number, string>([
  [401, SIGNED_OUT],
  [403, "You no longer have access to this page."],
  [404, "This page is no longer available."],
  [410, "This page is no longer available."],
])

export function pageReason(error: unknown): string | null {
  return error instanceof ApiError
    ? (PAGE_REASONS.get(error.status) ?? null)
    : null
}

function lineRefusalNote(error: unknown): string | null {
  if (!(error instanceof ApiError)) return null
  if (error.status !== 400 && error.status !== 409) return null
  return error.message || "Paper could not save this line."
}

export function pageWords(blocks: readonly { text: string }[]): string {
  return blocks.map((block) => block.text).join("\n")
}

export function savedNote(words: string, outcome: SaveOutcome): string | null {
  if (words === "" && !outcome.saved) return null
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
  unanswered.clear()
  retryAt.clear()
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

type Sent =
  { revision: string | null; note: null } | { revision: null; note: string }

async function sendPage(
  docId: string,
  page: WordPage,
  blocks: readonly PageBlock[],
  caret: TextPoint | null
): Promise<Sent> {
  const diff = diffParagraphs(page, blocks, caret)
  if ("refused" in diff) return { revision: null, note: diff.refused }
  if (diff.ops.length === 0) return { revision: null, note: null }
  const input = paperCanvasCommitSchema.safeParse({
    op: "write",
    batch: { doc: page.doc, basedOn: page.revision, ops: diff.ops },
  })
  if (!input.success)
    return {
      revision: null,
      note: input.error.issues[0]?.message ?? "Paper could not save this line.",
    }
  const words = pageWords(blocks)
  unanswered.set(docId, words)
  try {
    const revision = receiptRevision(
      await runContractCommand(commandClient(), "paper.canvas", input.data, {
        refresh: false,
      })
    )
    unanswered.delete(docId)
    if (revision) ownWrites.set(docId, recordedBasis(revision, words))
    return { revision, note: null }
  } catch (error) {
    const note = lineRefusalNote(error)
    if (note === null) throw error
    unanswered.delete(docId)
    return { revision: null, note }
  }
}

function caretIn(caret: TextPoint | null, ids: readonly string[]) {
  return caret && ids.includes(caret.blockId) ? caret : null
}

type Isolated =
  | { head: WordPage; refused: LineRefusal[]; landed: boolean }
  | { moved: true }
  | null

async function stillOurs(
  docId: string,
  head: WordPage,
  signal: AbortSignal
): Promise<WordPage | "moved" | null> {
  const now = await readPage(docId, signal)
  if (!now || signal.aborted) return null
  return now.revision === head.revision ? now : "moved"
}

async function isolate(
  docId: string,
  page: WordPage,
  blocks: readonly PageBlock[],
  caret: TextPoint | null,
  signal: AbortSignal,
  firstNote: string
): Promise<Isolated> {
  let head = page
  const refused: LineRefusal[] = []
  let landed = false
  const units = lineUnits(pageBlocks(page), blocks)
  const texts = new Map(blocks.map((block) => [block.id, block.text]))
  const single = units.lines.length + (units.rest.length > 0 ? 1 : 0) <= 1
  if (single) {
    const ids = [...units.lines.map((line) => line.id), ...units.rest]
    return {
      head,
      landed,
      refused: ids.map((id) => ({
        id,
        text: texts.get(id) ?? "",
        note: firstNote,
      })),
    }
  }
  for (const unit of units.lines) {
    if (signal.aborted) return null
    const candidate = withLine(pageBlocks(head), unit.id, unit.text)
    const sent = await sendPage(
      docId,
      head,
      candidate,
      caretIn(caret, [unit.id])
    )
    if (sent.note === null && sent.revision) {
      const next = await readPage(docId, signal)
      if (!next || next.revision !== sent.revision) return null
      head = next
      landed = true
      continue
    }
    if (sent.note === null) continue
    const now = await stillOurs(docId, head, signal)
    if (now === "moved") return { moved: true }
    if (!now) return null
    refused.push({ ...unit, note: sent.note })
  }
  if (units.rest.length === 0) return { head, refused, landed }
  const rest = withoutRefused(pageBlocks(head), blocks, refused)
  const sent = await sendPage(docId, head, rest, caretIn(caret, units.rest))
  if (sent.note === null && sent.revision) {
    const next = await readPage(docId, signal)
    if (!next || next.revision !== sent.revision) return null
    return { head: next, refused, landed: true }
  }
  if (sent.note === null) return { head, refused, landed }
  const now = await stillOurs(docId, head, signal)
  if (now === "moved") return { moved: true }
  if (!now) return null
  return {
    head,
    landed,
    refused: refused.concat(
      units.rest.map((id) => ({
        id,
        text: texts.get(id) ?? "",
        note: sent.note,
      }))
    ),
  }
}

function sameNote(refused: readonly LineRefusal[]) {
  return refused.every((line) => line.note === refused[0]?.note)
}

function receiptRevision(value: unknown) {
  if (!value || typeof value !== "object") return null
  if (!("generation" in value) || value.generation !== "package") return null
  if (!("revision" in value) || typeof value.revision !== "string") return null
  return value.revision
}

const tails = new Map<string, Promise<unknown>>()
const ownWrites = new Map<string, DraftBasis>()
const unanswered = new Map<string, string>()
const retryAt = new Map<string, number>()

function basisAt(
  docId: string,
  page: WordPage,
  claimed: DraftBasis | null
): DraftBasis | null {
  const own = ownWrites.get(docId)
  if (own && own.revision === page.revision) return own
  const sent = unanswered.get(docId)
  if (sent !== undefined && sent === pageText(page)) {
    return recordedBasis(page.revision, sent)
  }
  return claimed
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
  const page = await readPage(docId, signal)
  if (!page || signal.aborted) return missed(words)
  const seen = pageText(page)
  const basis = basisAt(docId, page, claim.basis)
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
  const carried = stillRefused(claim.refused ?? [], blocks)
  const sending = withoutRefused(pageBlocks(page), blocks, carried)
  const caret = claim.caret ?? null
  const sent = await sendPage(docId, page, sending, caret)
  if (sent.note !== null) {
    const now = await stillOurs(docId, page, signal)
    if (now === "moved")
      return { saved: false, words, revision: null, note: null, conflict: true }
    if (!now) return missed(words)
    const isolated = await isolate(
      docId,
      now,
      sending,
      caret,
      signal,
      sent.note
    )
    if (!isolated) return missed(words)
    if ("moved" in isolated)
      return { saved: false, words, revision: null, note: null, conflict: true }
    const refused = carried.concat(isolated.refused)
    const whole = !isolated.landed && refused.length > 1 && sameNote(refused)
    const head = isolated.head
    return {
      saved: false,
      words,
      revision: head.revision,
      note: null,
      basis: recordedBasis(head.revision, pageText(head)),
      refusedLines: refused,
      pageRefusal: whole ? sent.note : null,
    }
  }
  if (!sent.revision) {
    if (carried.length === 0) return missed(words)
    return { ...missed(words), refusedLines: carried }
  }
  if (signal.aborted) return missed(words)
  const sentWords = pageWords(sending)
  const next = await readPage(docId, signal)
  if (
    !next ||
    next.revision !== sent.revision ||
    pageText(next) !== sentWords
  ) {
    return missed(words)
  }
  const adopted = adoptedBlocks(next, blocks)
  return {
    saved: sentWords === words,
    words,
    revision: next.revision,
    note: null,
    basis: recordedBasis(next.revision, sentWords),
    refusedLines: carried,
    pageRefusal: null,
    ...(adopted ? { blocks: adopted } : {}),
  }
}

type RetryWait = { until: number } | "online" | null

type Attempt = { outcome: SaveOutcome; wait: RetryWait }

function retryWait(error: unknown): RetryWait {
  if (error instanceof ApiError) {
    return error.retryAfterMs === undefined
      ? null
      : { until: Date.now() + error.retryAfterMs }
  }
  return typeof navigator !== "undefined" && navigator.onLine === false
    ? "online"
    : null
}

async function attempt(
  docId: string,
  blocks: readonly PageBlock[],
  signal: AbortSignal,
  claim: SettleClaim
): Promise<Attempt> {
  try {
    return {
      outcome: await settleOnce(docId, blocks, signal, claim),
      wait: null,
    }
  } catch (error) {
    const page = pageReason(error)
    if (page) {
      return {
        outcome: { ...missed(pageWords(blocks)), pageRefusal: page },
        wait: null,
      }
    }
    return {
      outcome: { ...missed(pageWords(blocks)), note: serverNote(error) },
      wait: retryWait(error),
    }
  }
}

function abortable(
  signal: AbortSignal,
  start: (done: () => void) => () => void
): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) return resolve()
    const finish = () => {
      stop()
      signal.removeEventListener("abort", finish)
      resolve()
    }
    const stop = start(finish)
    signal.addEventListener("abort", finish, { once: true })
  })
}

function serverReady(docId: string, signal: AbortSignal): Promise<void> {
  const left = (retryAt.get(docId) ?? 0) - Date.now()
  if (left <= 0) {
    retryAt.delete(docId)
    return Promise.resolve()
  }
  return abortable(signal, (done) => {
    const timer = setTimeout(done, left)
    return () => clearTimeout(timer)
  })
}

function connectionBack(signal: AbortSignal): Promise<void> {
  if (navigator.onLine) return Promise.resolve()
  return abortable(signal, (done) => {
    window.addEventListener("online", done, { once: true })
    return () => window.removeEventListener("online", done)
  })
}

async function settleWhenReachable(
  docId: string,
  blocks: readonly PageBlock[],
  signal: AbortSignal,
  claim: SettleClaim
): Promise<SaveOutcome> {
  for (;;) {
    await serverReady(docId, signal)
    const { outcome, wait } = await attempt(docId, blocks, signal, claim)
    if (wait === null || signal.aborted) return outcome
    if (wait === "online") await connectionBack(signal)
    else retryAt.set(docId, wait.until)
  }
}

export function settlePage(
  docId: string,
  blocks: readonly PageBlock[],
  signal: AbortSignal,
  claim: SettleClaim = { basis: null, typed: true }
): Promise<SaveOutcome> {
  return serial(docId, () => settleWhenReachable(docId, blocks, signal, claim))
}
