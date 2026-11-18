import "fake-indexeddb/auto"

import { afterEach, beforeEach, vi } from "vitest"
import { act, cleanup, screen } from "@testing-library/react"
import type { WordPage } from "@workspace/domain"

import { render } from "@/test/render-with-client.tsx"

import { branchKey, rotateWriter } from "@/features/paper-page/canvas-branch.ts"

import { draftFromPage } from "@/features/paper-page/canvas-edit.ts"
import { WritingCanvas } from "@/features/paper-page/canvas.tsx"
import { closeWritingDb } from "@/features/paper-page/canvas-save.ts"
import { setWritingConflict } from "@/lib/writing-refresh.ts"

export const DOC = "11111111-1111-7111-8111-111111111111"
export const PACKAGE = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
export const INCARNATION = "cccccccc-cccc-4ccc-8ccc-cccccccccccc"
export const HASH = "ab".repeat(32)

export const L = {
  name: "44444444-4444-4444-8444-000000000001",
  job: "44444444-4444-4444-8444-000000000002",
  available: "44444444-4444-4444-8444-000000000003",
  education: "44444444-4444-4444-8444-000000000004",
}
export const START = {
  [L.name]: "Linh Nguyen",
  [L.job]: "Marketing Intern, Lumière",
  [L.available]: "Available from June 2026",
  [L.education]: "Education",
}
export const SENTENCE =
  " \u2014 I led a five-person team and planned the spring launch"

export const MIXED =
  "This line mixes formatting, such as bold or a different font. Paper will not rewrite words across that formatting. No document was changed."
export const HELD_GAP =
  "Part of this line is kept exactly as it is in Word, such as a link or a break. Paper will not move words across it. No document was changed."
export const CARET =
  "The caret is outside this line's words. No document was changed."
export const READ_ONLY =
  "Paper can read this Word file but cannot safely change its current features yet."
export const QUOTA =
  "Word edit storage is full. Your document, saved reviews, and Undo are unchanged."
export const STALE =
  "This Word document has changed. Read it again before editing."
export const GONE =
  "This saved Word edit is no longer available. No document was changed."

type Line = { handle: string; text: string }
type Op =
  | { op: "setText"; handle: string; text: string }
  | { op: "insert"; after: string | null; text: string }
  | { op: "delete"; handle: string }
type Batch = { doc: string; basedOn: string; ops: Op[] }

export function revisionNumber(n: number) {
  return `bbbbbbbb-bbbb-4bbb-8bbb-${String(n).padStart(12, "0")}`
}

export function failure(status: number, code: string, message: string) {
  return Response.json({ ok: false, error: { code, message } }, { status })
}

export function fakeServer() {
  const state = {
    revision: revisionNumber(0),
    lines: Object.entries(START).map(([handle, text]) => ({
      handle,
      text,
    })) as Line[],
    committed: [] as string[],
    batches: [] as Batch[],
    attempts: [] as { input: { batch: Batch }; idempotencyKey: string }[],
    posts: 0,
    offline: false,
    loseReplies: 0,
    timeouts: 0,
    busy: [] as { status: number; retryAfter: string | null }[],
    refuse: null as null | ((op: Op) => string | null),
    answer: null as null | { status: number; code: string; message: string },
    raceOnce: null as null | { handle: string; text: string; reply: string },
    hold: null as null | Promise<void>,
  }
  const receipts = new Map<string, { input: string; data: unknown }>()
  let revisions = 0
  let handles = 10
  const words = () => state.lines.map((line) => line.text).join("\n")
  const lineOf = (line: Line) => ({
    handle: line.handle,
    text: line.text,
    pieces: line.text === "" ? [] : [{ text: line.text, editable: true }],
    held: false,
    message: "",
    code: null,
  })
  const moveTo = (handle: string, text: string) => {
    const line = state.lines.find((item) => item.handle === handle)
    if (line) line.text = text
    revisions += 1
    state.revision = revisionNumber(revisions)
  }
  const apply = (batch: Batch) => {
    for (const op of batch.ops) {
      if (op.op === "setText") {
        const line = state.lines.find((item) => item.handle === op.handle)
        if (!line) throw new Error(`unknown handle ${op.handle}`)
        line.text = op.text
      } else if (op.op === "insert") {
        handles += 1
        const at =
          op.after === null
            ? 0
            : state.lines.findIndex((item) => item.handle === op.after) + 1
        state.lines.splice(at, 0, {
          handle: `44444444-4444-4444-8444-${String(handles).padStart(12, "0")}`,
          text: op.text,
        })
      } else {
        state.lines = state.lines.filter((item) => item.handle !== op.handle)
      }
    }
    revisions += 1
    state.revision = revisionNumber(revisions)
    state.committed.push(words())
  }
  const page = () => ({
    doc: DOC,
    revision: state.revision,
    name: "Page.docx",
    label: "cv",
    paragraphs: state.lines.map(lineOf),
  })
  const fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    if (state.offline) throw new TypeError("Failed to fetch")
    if (state.answer)
      return failure(
        state.answer.status,
        state.answer.code,
        state.answer.message
      )
    if (!url.includes("/api/commands/paper.canvas")) {
      if (url.includes("/api/reads/paper.read"))
        return Response.json({ ok: true, data: page() })
      return new Response("missing", { status: 404 })
    }
    state.posts += 1
    const busy = state.busy.shift()
    if (busy)
      return Response.json(
        { ok: false, error: { code: "BUSY", message: "The server is busy." } },
        {
          status: busy.status,
          headers:
            busy.retryAfter === null ? {} : { "Retry-After": busy.retryAfter },
        }
      )
    if (state.timeouts > 0) {
      state.timeouts -= 1
      throw new DOMException("The operation timed out.", "TimeoutError")
    }
    const command = JSON.parse(String(init?.body)) as {
      input: { batch: Batch }
      idempotencyKey: string
    }
    state.attempts.push(structuredClone(command))
    const replay = receipts.get(command.idempotencyKey)
    if (replay)
      return JSON.stringify(command.input) === replay.input
        ? Response.json({ ok: true, data: replay.data })
        : failure(
            409,
            "IDEMPOTENCY_CONFLICT",
            "The original command input changed."
          )
    const batch = command.input.batch
    state.batches.push(batch)
    if (state.hold) await state.hold
    const race = state.raceOnce
    if (race) {
      state.raceOnce = null
      moveTo(race.handle, race.text)
      return failure(409, "CONFLICT", race.reply)
    }
    if (batch.basedOn !== state.revision) return failure(409, "CONFLICT", STALE)
    const refused = state.refuse
      ? batch.ops.map((op) => state.refuse?.(op) ?? null).find(Boolean)
      : null
    if (refused) return failure(409, "CONFLICT", refused)
    apply(batch)
    const data = {
      generation: "package",
      docId: DOC,
      revision: state.revision,
      activityId: revisionNumber(1000 + revisions),
      name: "Page.docx",
      kind: "cv",
      packageHash: HASH,
      byteSize: 128,
      incarnation: INCARNATION,
      restore: null,
    }
    receipts.set(command.idempotencyKey, {
      input: JSON.stringify(command.input),
      data,
    })
    if (state.loseReplies > 0) {
      state.loseReplies -= 1
      throw new TypeError("Failed to fetch")
    }
    return Response.json({ ok: true, data })
  }
  vi.stubGlobal("fetch", fetch)
  vi.spyOn(navigator, "onLine", "get").mockImplementation(() => !state.offline)
  return {
    state,
    words,
    page: () => page() as unknown as WordPage,
    textOf: (handle: string) =>
      state.lines.find((line) => line.handle === handle)?.text,
    otherTab: moveTo,
  }
}

export type Server = ReturnType<typeof fakeServer>
export let server: Server
export let copied: string[] = []

export function realTurn() {
  return new Promise<void>((resolve) => setImmediate(resolve))
}

export async function settle(count = 120) {
  await act(async () => {
    for (let turn = 0; turn < count; turn += 1) await realTurn()
  })
}

export function lastLine() {
  const lines = surface().querySelectorAll<HTMLElement>(":scope > p")
  return lines[lines.length - 1]?.dataset.block ?? ""
}

export async function goOnline() {
  await act(async () => {
    server.state.offline = false
    window.dispatchEvent(new Event("online"))
  })
  await settle()
}

export function surface() {
  return screen.getByRole("article", { name: "Page" })
}

export function line(id: string) {
  const found = surface().querySelector<HTMLElement>(`p[data-block="${id}"]`)
  if (!found) throw new Error(`no line ${id}`)
  return found
}

export function shown(id: string) {
  return (line(id).textContent ?? "").replaceAll("​", "")
}

export function stored(): string {
  const raw = JSON.parse(localStorage.getItem(branchKey(DOC)) ?? "{}")
  const draft = raw.draft ?? raw
  return (draft.blocks ?? [])
    .map((item: { text: string }) => item.text)
    .join("\n")
}

export function status() {
  return document.querySelector("p.writing-note")?.textContent ?? ""
}

export function bar() {
  return screen.queryByRole("region", { name: "Unsaved words" })
}

export function caretAtEnd(id: string, at?: number) {
  const target = line(id)
  const walker = document.createTreeWalker(target, NodeFilter.SHOW_TEXT)
  let last: Text | null = null
  while (walker.nextNode()) last = walker.currentNode as Text
  const range = document.createRange()
  if (last) {
    const offset = at === undefined ? last.data.length : at
    range.setStart(last, offset)
    range.setEnd(last, offset)
  } else {
    range.setStart(target, 0)
    range.setEnd(target, 0)
  }
  const selection = document.getSelection()
  selection?.removeAllRanges()
  selection?.addRange(range)
}

export async function type(id: string, text: string, at?: number) {
  caretAtEnd(id, at)
  const event = new InputEvent("beforeinput", {
    inputType: "insertText",
    data: text,
    bubbles: true,
    cancelable: true,
  })
  await act(async () => {
    surface().dispatchEvent(event)
  })
  return event
}

export async function key(name: string, mods: Record<string, boolean> = {}) {
  await act(async () => {
    surface().dispatchEvent(
      new KeyboardEvent("keydown", {
        key: name,
        bubbles: true,
        cancelable: true,
        ...mods,
      })
    )
  })
}

export function open() {
  render(
    <WritingCanvas
      docId={DOC}
      seed={draftFromPage(server.page())}
      seedRevision={server.state.revision}
    />
  )
}

export async function reload() {
  cleanup()
  await closeWritingDb()
  rotateWriter(DOC)
  open()
  await settle()
}

export async function recover() {
  const button = await screen.findByRole("button", {
    name: /^Recover local copy/,
  })
  await act(async () => button.click())
  await settle()
}

export async function opened() {
  open()
  await settle()
}

export function release() {
  let done = () => undefined as void
  server.state.hold = new Promise<void>((resolve) => {
    done = () => {
      server.state.hold = null
      resolve()
    }
  })
  return done
}

export function openUnsavedPageSuite() {
  beforeEach(() => {
    rotateWriter(DOC)
    server = fakeServer()
    copied = []
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: (text: string) => {
          copied.push(text)
          return Promise.resolve()
        },
      },
    })
  })

  afterEach(async () => {
    cleanup()
    setWritingConflict(null)
    localStorage.clear()
    vi.useRealTimers()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    await closeWritingDb()
    await new Promise<void>((resolve, reject) => {
      const deleting = indexedDB.deleteDatabase("opencv-writing")
      deleting.onsuccess = () => resolve()
      deleting.onerror = () => reject(deleting.error)
      deleting.onblocked = () => resolve()
    })
  })
}

export function refuseAvailable(note: string) {
  server.state.refuse = (op) =>
    op.op === "setText" &&
    op.handle === L.available &&
    op.text !== START[L.available]
      ? note
      : null
}
