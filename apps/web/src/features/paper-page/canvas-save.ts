import { paperCanvasCommitSchema, type WordPage } from "@workspace/domain"

import { ApiError } from "@/lib/api-error.ts"
import {
  applyReply,
  type Acknowledgement,
  type LocalObservation,
  type PackageDraft,
} from "@/lib/paper-package-ack.ts"
import {
  draftFromPage,
  pageBlocks,
  type DraftBasis,
  type TextPoint,
} from "./canvas-edit.ts"
import { readWordPage } from "./package-read.ts"
import {
  adoptedBlocks,
  headOf,
  missed,
  movedTo,
  pageText,
  recordedBasis,
  renamedBlocks,
  withRefusals,
  withRenames,
  type SaveOutcome,
} from "./canvas-save-outcome.ts"
import { diffParagraphs } from "./page-diff.ts"
import { replayPending, transmit } from "./canvas-attempt.ts"
import {
  closeRecordDb,
  commitWords,
  ownSent,
  recordSent,
  type SentRecord,
} from "./canvas-save-record.ts"
import {
  landedRenames,
  lineUnits,
  stillRefused,
  uniqueRefusals,
  withLine,
  withoutRefused,
  type LineRefusal,
  type PageBlock,
} from "./canvas-save-lines.ts"

const SERVER_NOTES = new Set([
  "This Word document has changed. Read it again before editing.",
])

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

export { commitWords }

export function decideSave(
  draft: PackageDraft,
  local: LocalObservation | null,
  reply: Acknowledgement
): PackageDraft {
  return applyReply(draft, local, reply)
}

export async function closeWritingDb() {
  retryAt.clear()
  await closeRecordDb()
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

async function readPage(docId: string, signal: AbortSignal) {
  return readWordPage("page", docId, signal)
}

function earlierRenames(
  page: WordPage,
  blocks: readonly PageBlock[],
  kept: SentRecord | undefined
): Record<string, string> {
  const server = pageBlocks(page)
  const landed =
    kept?.receipt?.revision === page.revision
      ? landedRenames(kept.blocks, server)
      : null
  const own = new Set(blocks.map((block) => block.id))
  const onServer = new Set(server.map((block) => block.id))
  return Object.fromEntries(
    Object.entries(landed ?? {}).filter(
      ([from, to]) => own.has(from) && !own.has(to) && onServer.has(to)
    )
  )
}

type Sent =
  { revision: string | null; note: null } | { revision: null; note: string }

async function sendPage(
  docId: string,
  page: WordPage,
  blocks: readonly PageBlock[],
  caret: TextPoint | null,
  held: string | null
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
  if (input.data.op !== "write") throw new Error("Expected a Word write.")
  const words = pageWords(blocks)
  const frozen = await recordSent(docId, {
    input: input.data,
    words,
    bases: [...new Set([held, page.revision].filter((name) => name !== null))],
    blocks: blocks.slice(),
  })
  const sent = await transmit(docId, frozen)
  return sent.note !== null
    ? { revision: null, note: sent.note }
    : { revision: sent.revision, note: null }
}

function caretIn(caret: TextPoint | null, ids: readonly string[]) {
  return caret && ids.includes(caret.blockId) ? caret : null
}

type Isolated =
  | {
      head: WordPage
      refused: LineRefusal[]
      landed: boolean
      renamed: Record<string, string>
    }
  | { moved: WordPage }
  | null

async function stillOurs(
  docId: string,
  head: WordPage,
  signal: AbortSignal
): Promise<{ page: WordPage } | { moved: WordPage } | null> {
  const now = await readPage(docId, signal)
  if (!now || signal.aborted) return null
  return now.revision === head.revision ? { page: now } : { moved: now }
}

async function isolate(
  docId: string,
  page: WordPage,
  blocks: readonly PageBlock[],
  caret: TextPoint | null,
  signal: AbortSignal,
  firstNote: string,
  answered: LineRefusal[],
  held: string | null
): Promise<Isolated> {
  let head = page
  const refused: LineRefusal[] = []
  const refuse = (line: LineRefusal) => {
    refused.push(line)
    answered.push(line)
  }
  let landed = false
  const units = lineUnits(pageBlocks(page), blocks)
  const texts = new Map(blocks.map((block) => [block.id, block.text]))
  const structural = units.rest.length > 0 || units.removed.length > 0
  const structure = (note: string): LineRefusal[] => [
    ...units.rest.map((id) => ({ id, text: texts.get(id) ?? "", note })),
    ...units.removed.map((line) => ({
      ...line,
      note,
      removed: true as const,
    })),
  ]
  if (units.lines.length + (structural ? 1 : 0) <= 1) {
    units.lines.forEach((line) => refuse({ ...line, note: firstNote }))
    structure(firstNote).forEach(refuse)
    return { head, landed, refused, renamed: {} }
  }
  for (const unit of units.lines) {
    if (signal.aborted) return null
    const candidate = withLine(pageBlocks(head), unit.id, unit.text)
    const sent = await sendPage(
      docId,
      head,
      candidate,
      caretIn(caret, [unit.id]),
      held
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
    if (!now || "moved" in now) return now
    refuse({ ...unit, note: sent.note })
  }
  if (!structural) return { head, refused, landed, renamed: {} }
  if (signal.aborted) return null
  const rest = withoutRefused(pageBlocks(head), blocks, refused)
  const sent = await sendPage(
    docId,
    head,
    rest,
    caretIn(caret, units.rest),
    held
  )
  if (sent.note === null && sent.revision) {
    const next = await readPage(docId, signal)
    if (!next || next.revision !== sent.revision) return null
    const renamed = landedRenames(rest, pageBlocks(next)) ?? {}
    return { head: next, refused, landed: true, renamed }
  }
  if (sent.note === null) return { head, refused, landed, renamed: {} }
  const now = await stillOurs(docId, head, signal)
  if (!now || "moved" in now) return now
  structure(sent.note).forEach(refuse)
  return { head, refused, landed, renamed: {} }
}

function sameNote(refused: readonly LineRefusal[]) {
  return refused.every((line) => line.note === refused[0]?.note)
}

const tails = new Map<string, Promise<unknown>>()
const retryAt = new Map<string, number>()

function basisAt(
  page: WordPage,
  claimed: DraftBasis | null,
  kept: SentRecord | undefined
): DraftBasis | null {
  return kept?.receipt?.revision === page.revision
    ? recordedBasis(page.revision, kept.words)
    : claimed
}

export function serial<T>(docId: string, job: () => Promise<T>): Promise<T> {
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
  given: readonly PageBlock[],
  signal: AbortSignal,
  claim: SettleClaim,
  answered: LineRefusal[]
): Promise<SaveOutcome> {
  const words = pageWords(given)
  if (signal.aborted) return missed(words)
  const committed = await commitWords(docId, words, given, claim.basis)
  if (committed.local.transaction !== "complete")
    return { ...missed(words), local: false }
  const record = await replayPending(docId, committed.record)
  const page = await readPage(docId, signal)
  if (!page || signal.aborted) return missed(words)
  const seen = pageText(page)
  const kept = ownSent(record, claim.basis, page.revision, seen)
  const basis = basisAt(page, claim.basis, kept)
  if (words === seen && (words !== "" || basis !== null)) {
    const renames = landedRenames(given, pageBlocks(page)) ?? {}
    return withRenames(
      {
        saved: true,
        words,
        revision: page.revision,
        note: null,
        ...headOf(page),
      },
      renames
    )
  }
  const renames = earlierRenames(page, given, kept)
  const blocks = renamedBlocks(given, renames)
  const changed = basis ? words !== basis.words : claim.typed
  const serverMoved =
    basis?.revision != null && page.revision !== basis.revision
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
  if (serverMoved || (!basis && seen !== "")) return movedTo(words, page)
  const carried = stillRefused([...(claim.refused ?? []), ...answered], blocks)
  const sending = withoutRefused(pageBlocks(page), blocks, carried)
  const caret = claim.caret ?? null
  const sent = await sendPage(
    docId,
    page,
    sending,
    caret,
    claim.basis?.revision ?? null
  )
  if (sent.note !== null) {
    const now = await stillOurs(docId, page, signal)
    if (now && "moved" in now) return movedTo(words, now.moved)
    if (!now) return withRefusals(missed(words), carried)
    const isolated = await isolate(
      docId,
      now.page,
      sending,
      caret,
      signal,
      sent.note,
      answered,
      claim.basis?.revision ?? null
    )
    if (!isolated)
      return withRefusals(
        missed(words),
        stillRefused([...carried, ...answered], blocks)
      )
    if ("moved" in isolated) return movedTo(words, isolated.moved)
    const refused = uniqueRefusals(carried.concat(isolated.refused))
    const whole =
      !isolated.landed &&
      isolated.refused.length > 1 &&
      sameNote(isolated.refused)
    return withRenames(
      {
        saved: false,
        words,
        revision: isolated.head.revision,
        note: null,
        ...headOf(isolated.head),
        refusedLines: refused,
        pageRefusal: whole ? sent.note : null,
      },
      { ...renames, ...isolated.renamed }
    )
  }
  if (!sent.revision) {
    if (carried.length === 0 && Object.keys(renames).length === 0)
      return missed(words)
    return withRenames(
      {
        saved: false,
        words,
        revision: page.revision,
        note: null,
        ...headOf(page),
        refusedLines: carried,
        pageRefusal: null,
      },
      renames
    )
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
  const landed = landedRenames(sending, pageBlocks(next)) ?? {}
  return withRenames(
    {
      saved: sentWords === words,
      words,
      revision: next.revision,
      note: null,
      ...headOf(next),
      basis: recordedBasis(next.revision, sentWords),
      refusedLines: carried,
      pageRefusal: null,
      ...(adopted ? { blocks: adopted } : {}),
    },
    { ...renames, ...landed }
  )
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
  claim: SettleClaim,
  answered: LineRefusal[]
): Promise<Attempt> {
  try {
    return {
      outcome: {
        local: true,
        ...(await settleOnce(docId, blocks, signal, claim, answered)),
      },
      wait: null,
    }
  } catch (error) {
    const known = stillRefused([...(claim.refused ?? []), ...answered], blocks)
    const page = pageReason(error)
    if (page) {
      return {
        outcome: withRefusals(
          { ...missed(pageWords(blocks)), local: true, pageRefusal: page },
          known
        ),
        wait: null,
      }
    }
    return {
      outcome: withRefusals(
        { ...missed(pageWords(blocks)), local: true, note: serverNote(error) },
        answered.length > 0 ? known : []
      ),
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
  const answered: LineRefusal[] = []
  for (;;) {
    await serverReady(docId, signal)
    const { outcome, wait } = await attempt(
      docId,
      blocks,
      signal,
      claim,
      answered
    )
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
