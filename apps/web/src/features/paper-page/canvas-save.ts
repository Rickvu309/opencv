import { QueryClient } from "@tanstack/react-query"
import {
  paperCanvasCommitSchema,
  paperIdSchema,
  paperPackageEditSchema,
} from "@workspace/domain"

import { ApiError } from "@/lib/api-error.ts"
import {
  applyReply,
  type Acknowledgement,
  type LocalObservation,
  type PackageDraft,
} from "@/lib/paper-package-ack.ts"
import { runContractCommand } from "@/lib/contract-client.ts"
import {
  draftFromRegions,
  type DraftBasis,
  type WritingBlock,
  type WritingDraft,
} from "./canvas-edit.ts"
import { readWholePackage } from "./package-read.ts"

const DATABASE = "opencv-writing"
const TABLE = "pages"
const CARRIERS = new Set([
  "OPAQUE_OR_SECTION_BOUNDARY",
  "UNSUPPORTED_TARGET_PROPERTY",
])
const UNAVAILABLE = "Saved Word documents are unavailable."
const SERVER_NOTES = new Set([
  UNAVAILABLE,
  "This Word document has changed. Read it again before editing.",
  "This page change is not available. No document was changed.",
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
}

type PageRegion = {
  kind: string
  text: string
  paragraph?: string
  targetId?: string
  reason?: { code: string }
  location?: { kind: string }
}

type PageBlock = { id?: string; text: string; held?: boolean }

type ServerRow = { id: string; text: string; targetId: string | null }

type PagePlan =
  | {
      kind: "text"
      paragraph: string
      before: string
      after: string
      targetId: string | null
    }
  | { kind: "split"; paragraph: string; at: number }
  | { kind: "merge" | "delete"; paragraph: string }

type PackagePage = {
  revision: string
  regions: readonly PageRegion[]
}

type WritingTarget = {
  paragraph: string
  text: string
  targetId: string | null
}

export function pageWords(blocks: readonly { text: string }[]): string {
  return blocks.map((block) => block.text).join("\n")
}

export function savedNote(words: string, outcome: SaveOutcome): string | null {
  if (words === "") return null
  if (outcome.note === UNAVAILABLE) return "Word documents are unavailable."
  if (outcome.note && SERVER_NOTES.has(outcome.note)) return outcome.note
  if (
    words === "" ||
    !outcome.saved ||
    outcome.words !== words ||
    outcome.revision === null
  ) {
    return null
  }
  return "Saved"
}

export function wordsFromRegions(
  regions: readonly { text: string; reason?: { code: string } }[]
): string {
  return regions
    .filter((region) => !CARRIERS.has(region.reason?.code ?? ""))
    .map((region) => region.text)
    .join("\n")
}

export function packageWords(
  regions: readonly {
    kind: string
    text: string
    paragraph?: string
    reason?: { code: string; message?: string }
    location?: { kind: string }
  }[]
): string {
  const draft = draftFromRegions(regions)
  return draft ? pageWords(draft.blocks) : wordsFromRegions(regions)
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
  return error instanceof ApiError && SERVER_NOTES.has(error.message)
    ? error.message
    : null
}

let commands: QueryClient | null = null

function commandClient() {
  commands ??= new QueryClient()
  return commands
}

function isPackagePage(value: unknown): value is PackagePage {
  if (!value || typeof value !== "object") return false
  if (!("revision" in value) || typeof value.revision !== "string") return false
  return "regions" in value && Array.isArray(value.regions)
}

async function readPackage(docId: string, signal: AbortSignal) {
  const page = await readWholePackage("page", docId, signal)
  return page && isPackagePage(page) ? page : null
}

function writingTarget(regions: readonly PageRegion[]): WritingTarget | null {
  for (const region of regions) {
    if (!region.paragraph) continue
    if (region.reason?.code === "EMPTY_TARGET") {
      return { paragraph: region.paragraph, text: "", targetId: null }
    }
    if (region.kind === "editable" && region.targetId) {
      return {
        paragraph: region.paragraph,
        text: region.text,
        targetId: region.targetId,
      }
    }
  }
  return null
}

function receiptRevision(value: unknown) {
  if (!value || typeof value !== "object") return null
  if (!("generation" in value) || value.generation !== "package") return null
  if (!("revision" in value) || typeof value.revision !== "string") return null
  return value.revision
}

async function sendWords(
  docId: string,
  revision: string,
  target: WritingTarget,
  words: string,
  signal: AbortSignal
) {
  if (target.text === "" && target.targetId === null) {
    const input = {
      op: "writeText" as const,
      docId,
      basedOn: revision,
      paragraph: target.paragraph,
      text: words,
    }
    if (!paperCanvasCommitSchema.safeParse(input).success) return null
    return receiptRevision(
      await runContractCommand(commandClient(), "paper.canvas", input, {
        refresh: false,
        signal,
      })
    )
  }
  if (!target.targetId || target.text === "") return null
  if (/[\r\n]/.test(words)) return null
  const id = paperIdSchema.safeParse(docId)
  if (!id.success) return null
  const input = {
    docId: id.data,
    basedOn: revision,
    edits: [
      {
        op: "replaceText" as const,
        targetId: target.targetId,
        before: target.text,
        after: words,
      },
    ],
  }
  if (!paperPackageEditSchema.safeParse(input).success) return null
  return receiptRevision(
    await runContractCommand(commandClient(), "paper.edit", input, {
      refresh: false,
      signal,
    })
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

function serverRows(regions: readonly PageRegion[]) {
  const writing: ServerRow[] = []
  const held: { id: string; text: string }[] = []
  for (const region of regions) {
    if (!region.paragraph) continue
    const table = region.location?.kind === "table-cell"
    const carrier =
      CARRIERS.has(region.reason?.code ?? "") && region.text === ""
    const open =
      !table &&
      (region.reason?.code === "EMPTY_TARGET" ||
        (region.kind === "editable" && !region.reason))
    if (open) {
      const previous = writing[writing.length - 1]
      if (previous?.id === region.paragraph) {
        previous.text += region.text
        continue
      }
      writing.push({
        id: region.paragraph,
        text: region.reason?.code === "EMPTY_TARGET" ? "" : region.text,
        targetId:
          region.reason?.code === "EMPTY_TARGET"
            ? null
            : (region.targetId ?? null),
      })
      continue
    }
    if (!carrier && (region.kind === "locked" || table)) {
      held.push({ id: region.paragraph, text: region.text })
    }
  }
  return { writing, held }
}

function heldMatches(
  server: readonly { id: string; text: string }[],
  blocks: readonly PageBlock[]
) {
  const mine = blocks.filter((block) => block.held)
  return (
    mine.length === server.length &&
    mine.every(
      (block, index) =>
        block.id === server[index]?.id && block.text === server[index]?.text
    )
  )
}

function aligned(
  local: readonly { id: string; text: string }[],
  remote: readonly ServerRow[],
  localAt: number,
  remoteAt: number
) {
  return remote.slice(remoteAt).every((row, offset) => {
    const block = local[localAt + offset]
    return block?.id === row.id && block.text === row.text
  })
}

function planChange(
  regions: readonly PageRegion[],
  blocks: readonly PageBlock[]
): PagePlan | null {
  const server = serverRows(regions)
  if (!heldMatches(server.held, blocks)) return null
  const local = blocks
    .filter((block) => !block.held)
    .map((block) => ({ id: block.id ?? "", text: block.text }))
  const remote = server.writing
  if (
    local.length === remote.length &&
    local.every((block, index) => block.id === remote[index]?.id)
  ) {
    const changed = local.flatMap((block, index) =>
      block.text === remote[index]?.text ? [] : [index]
    )
    const index = changed.length === 1 ? changed[0] : undefined
    const before = index === undefined ? undefined : remote[index]
    const after = index === undefined ? undefined : local[index]?.text
    if (
      index === undefined ||
      !before ||
      after === undefined ||
      after === "" ||
      /[\r\n]/.test(after)
    ) {
      return null
    }
    return {
      kind: "text",
      paragraph: before.id,
      before: before.text,
      after,
      targetId: before.targetId,
    }
  }
  if (local.length === remote.length + 1) {
    for (const [index, source] of remote.entries()) {
      const left = local[index]
      const right = local[index + 1]
      if (!left || !right || left.id !== source.id) continue
      if (left.text + right.text !== source.text) continue
      if (remote.some((row) => row.id === right.id)) continue
      if (
        !remote
          .slice(0, index)
          .every(
            (row, offset) =>
              local[offset]?.id === row.id && local[offset]?.text === row.text
          )
      ) {
        continue
      }
      if (!aligned(local, remote, index + 2, index + 1)) continue
      if (/[\r\n]/.test(left.text) || /[\r\n]/.test(right.text)) return null
      return { kind: "split", paragraph: source.id, at: [...left.text].length }
    }
  }
  if (local.length + 1 === remote.length) {
    for (const [index, block] of local.entries()) {
      const first = remote[index]
      const second = remote[index + 1]
      if (!first || !second || block.id !== first.id || second.text === "") {
        continue
      }
      if (block.text !== first.text + second.text) continue
      if (
        !remote
          .slice(0, index)
          .every(
            (row, offset) =>
              local[offset]?.id === row.id && local[offset]?.text === row.text
          )
      ) {
        continue
      }
      if (!aligned(local, remote, index + 1, index + 2)) continue
      return { kind: "merge", paragraph: second.id }
    }
    for (const [index, row] of remote.entries()) {
      if (row.text !== "") continue
      const rest = remote.filter((_, at) => at !== index)
      if (
        rest.length === local.length &&
        rest.every(
          (item, offset) =>
            local[offset]?.id === item.id && local[offset]?.text === item.text
        )
      ) {
        return { kind: "delete", paragraph: row.id }
      }
    }
  }
  return null
}

async function sendPlan(
  docId: string,
  revision: string,
  plan: PagePlan,
  signal: AbortSignal
) {
  if (plan.kind === "text") {
    return sendWords(
      docId,
      revision,
      {
        paragraph: plan.paragraph,
        text: plan.before,
        targetId: plan.targetId,
      },
      plan.after,
      signal
    )
  }
  const input =
    plan.kind === "split"
      ? {
          op: "split" as const,
          docId,
          basedOn: revision,
          paragraph: plan.paragraph,
          at: plan.at,
        }
      : {
          op:
            plan.kind === "merge"
              ? ("mergePrevious" as const)
              : ("deleteParagraph" as const),
          docId,
          basedOn: revision,
          paragraph: plan.paragraph,
        }
  if (!paperCanvasCommitSchema.safeParse(input).success) return null
  return receiptRevision(
    await runContractCommand(commandClient(), "paper.canvas", input, {
      refresh: false,
      signal,
    })
  )
}

function adoptedBlocks(
  regions: readonly PageRegion[],
  blocks: readonly PageBlock[]
) {
  const draft = draftFromRegions(regions)
  if (!draft || draft.blocks.length !== blocks.length) return undefined
  const same = draft.blocks.every(
    (block, index) =>
      block.text === blocks[index]?.text &&
      !!block.held === !!blocks[index]?.held
  )
  return same ? draft.blocks : undefined
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
    const page = await readPackage(docId, signal)
    if (!page || signal.aborted) return missed(words)
    const seen = packageWords(page.regions)
    const changed = claim.basis ? words !== claim.basis.words : claim.typed
    const serverMoved =
      claim.basis?.revision != null && page.revision !== claim.basis.revision
    if (words === seen && words !== "") {
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
      const replacement = draftFromRegions(page.regions)
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
    if (words === "") return missed(words)
    const planned = planChange(page.regions, blocks)
    const revision = planned
      ? await sendPlan(docId, page.revision, planned, signal)
      : blocks.some((block) => block.held)
        ? null
        : await (async () => {
            const target = writingTarget(page.regions)
            if (!target) return null
            return sendWords(docId, page.revision, target, words, signal)
          })()
    if (!revision || signal.aborted) return missed(words)
    const next = await readPackage(docId, signal)
    const readBack = next ? packageWords(next.regions) : null
    if (!next || next.revision !== revision || readBack !== words) {
      return missed(words)
    }
    const adopted = adoptedBlocks(next.regions, blocks)
    return {
      saved: true,
      words: readBack,
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
