import type {
  WordAlign,
  WordForm,
  WordMark,
  WordPage,
} from "@workspace/domain/paper-doc"

import { ApiError } from "@/lib/api-error.ts"

export const tally = new Map<string, number>()

export function count(name: string) {
  tally.set(name, (tally.get(name) ?? 0) + 1)
}

let doc = "11111111-1111-7111-8111-000000000000"
let walks = 0

export function docId() {
  return doc
}

export function nextDoc() {
  walks += 1
  doc = `11111111-1111-7111-8111-${String(walks).padStart(12, "0")}`
}

export type Net = {
  read: (docId: string, signal: AbortSignal) => Promise<unknown>
  send: (input: unknown, key?: string) => Promise<unknown>
}

export const net: Net = {
  read: () => Promise.resolve(null),
  send: () => Promise.resolve(null),
}
const PACKAGE = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
const HASH = "ab".repeat(32)

const REASONS: Record<string, string> = {
  "§": "This line mixes formatting, such as bold or a different font. Paper will not rewrite words across that formatting. No document was changed.",
  "¶": "Part of this line is kept exactly as it is in Word, such as a link or a break. Paper will not move words across it. No document was changed.",
  "¤": "The caret is outside this line's words. No document was changed.",
}
const KEPT_WHOLE =
  "Part of this line is kept exactly as it is in Word, such as a link or a break. Paper will not move words across it. No document was changed."
const STALE = "This Word document has changed. Read it again before editing."
const PAGE_MODES = {
  signedOut: { status: 401, code: "UNAUTHORIZED", reads: true },
  forbidden: { status: 403, code: "FORBIDDEN", reads: true },
  gone: { status: 404, code: "NOT_FOUND", reads: true },
  storageFull: {
    status: 409,
    code: "CONFLICT",
    reads: false,
    message:
      "Word edit storage is full. Your document, saved reviews, and Undo are unchanged.",
  },
  readOnly: {
    status: 409,
    code: "CONFLICT",
    reads: false,
    message:
      "Paper can read this Word file but cannot safely change its current features yet.",
  },
} as const
type Mode = keyof typeof PAGE_MODES | "ok"
type Fault = "none" | "offline" | "lost" | "busy429" | "busy503" | "timeout"
const FAULTS: Fault[] = ["offline", "lost", "busy429", "busy503", "timeout"]

export type ParagraphLook = {
  form?: WordForm
  align?: WordAlign
  marks?: readonly (readonly WordMark[])[]
  endMarks?: readonly WordMark[]
}
export type Line = {
  handle: string
  text: string
  version: number
  by: Author
  look?: ParagraphLook
}
type Author = "page" | "other"
export type Op =
  | { op: "setText"; handle: string; text: string }
  | { op: "insert"; after: string | null; text: string }
  | { op: "delete"; handle: string }

export type Step =
  | { kind: "type"; line: number; at: number; text: string }
  | { kind: "enter"; line: number; at: number }
  | { kind: "join"; line: number }
  | { kind: "deleteLine"; line: number }
  | { kind: "paste"; line: number; text: string }
  | { kind: "undo" }
  | { kind: "redo" }
  | { kind: "composeStart"; line: number }
  | { kind: "composeEnd"; text: string }
  | { kind: "answer"; pick: number; fault: Fault }
  | { kind: "drain" }
  | { kind: "time"; ms: number }
  | { kind: "elsewhere"; line: number; change: "edit" | "delete" | "rename" }
  | { kind: "mode"; mode: Mode }
  | { kind: "network"; online: boolean }
  | { kind: "reload" }
  | { kind: "useSaved" }
  | { kind: "restore"; pick: number }

function random(seed: number) {
  let value = seed >>> 0
  return () => {
    value = (value + 0x6d2b79f5) >>> 0
    let t = value
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function textFrom(next: () => number, length: number) {
  const plain = "abcdefgh ijk"
  let text = ""
  for (let index = 0; index < length; index += 1) {
    const roll = next()
    text +=
      roll < 0.012
        ? "§"
        : roll < 0.018
          ? "¶"
          : roll < 0.024
            ? "¤"
            : roll < 0.03
              ? "†"
              : (plain[Math.floor(next() * plain.length)] ?? "a")
  }
  return text
}

export function walkSteps(seed: number, count: number): Step[] {
  const next = random(seed)
  const int = (max: number) => Math.floor(next() * max)
  const modes = Object.keys(PAGE_MODES) as Mode[]
  const table: [number, () => Step][] = [
    [
      25,
      () => ({
        kind: "type",
        line: int(64),
        at: int(64),
        text: textFrom(next, 1 + int(4)),
      }),
    ],
    [5, () => ({ kind: "enter", line: int(64), at: int(64) })],
    [4, () => ({ kind: "join", line: int(64) })],
    [3, () => ({ kind: "deleteLine", line: int(64) })],
    [
      2,
      () => ({
        kind: "paste",
        line: int(64),
        text: Array.from({ length: 1 + int(3) }, () =>
          textFrom(next, 1 + int(5))
        ).join("\n"),
      }),
    ],
    [3, () => ({ kind: "undo" })],
    [2, () => ({ kind: "redo" })],
    [2, () => ({ kind: "composeStart", line: int(64) })],
    [2, () => ({ kind: "composeEnd", text: textFrom(next, 1 + int(3)) })],
    [
      28,
      () => ({
        kind: "answer",
        pick: int(8),
        fault: next() < 0.82 ? "none" : (FAULTS[int(FAULTS.length)] ?? "none"),
      }),
    ],
    [8, () => ({ kind: "drain" })],
    [3, () => ({ kind: "time", ms: 200 + int(6000) })],
    [
      1.5,
      () => ({
        kind: "elsewhere",
        line: int(64),
        change: next() < 0.7 ? "edit" : next() < 0.5 ? "delete" : "rename",
      }),
    ],
    [
      1,
      () => ({
        kind: "mode",
        mode: next() < 0.7 ? "ok" : (modes[int(modes.length)] ?? "ok"),
      }),
    ],
    [2.5, () => ({ kind: "network", online: next() < 0.65 })],
    [2, () => ({ kind: "reload" })],
    [3, () => ({ kind: "useSaved" })],
    [3, () => ({ kind: "restore", pick: int(8) })],
  ]
  const total = table.reduce((sum, [weight]) => sum + weight, 0)
  const steps: Step[] = []
  for (let index = 0; index < count; index += 1) {
    let roll = next() * total
    const entry = table.find(([weight]) => (roll -= weight) < 0) ?? table[0]
    if (entry) steps.push(entry[1]())
  }
  return steps
}

function revisionName(n: number) {
  return `bbbbbbbb-bbbb-4bbb-8bbb-${String(n).padStart(12, "0")}`
}

function handleName(n: number) {
  return `44444444-4444-4444-8444-${String(n).padStart(12, "0")}`
}

export class Failure extends Error {}

export function fail(message: string): never {
  throw new Failure(message)
}

type Pending = { kind: "read" | "send"; answer: (fault: Fault) => void }

export function tinyIndexedDb() {
  const rows = new Map<string, unknown>()
  const later = (job: () => void) => queueMicrotask(job)
  const database = {
    objectStoreNames: { contains: () => true },
    createObjectStore: () => undefined,
    close: () => undefined,
    transaction: () => {
      const staged = new Map<string, unknown>()
      let pending = 0
      let ended = false
      const tx: {
        error: null
        oncomplete: null | (() => void)
        onabort: null | (() => void)
        objectStore: () => unknown
        abort: () => void
      } = {
        error: null,
        oncomplete: null,
        onabort: null,
        objectStore: () => null,
        abort: () => {
          ended = true
          later(() => tx.onabort?.())
        },
      }
      const request = (read: () => unknown) => {
        const result: { result: unknown; onsuccess: null | (() => void) } = {
          result: undefined,
          onsuccess: null,
        }
        pending++
        later(() => {
          if (ended) return
          result.result = structuredClone(read())
          result.onsuccess?.()
          pending--
          later(() => {
            if (ended || pending) return
            ended = true
            for (const [key, value] of staged) rows.set(key, value)
            tx.oncomplete?.()
          })
        })
        return result
      }
      tx.objectStore = () => ({
        getAll: () =>
          request(() => [...new Map([...rows, ...staged]).values()]),
        get: (key: string) =>
          request(() => (staged.has(key) ? staged.get(key) : rows.get(key))),
        put: (value: { key: string }) =>
          request(() => {
            staged.set(value.key, structuredClone(value))
            return value.key
          }),
      })
      return tx
    },
  }
  return {
    open: () => {
      const request: {
        result: unknown
        onsuccess: null | (() => void)
        onerror: null | (() => void)
        onupgradeneeded: null | (() => void)
      } = {
        result: database,
        onsuccess: null,
        onerror: null,
        onupgradeneeded: null,
      }
      later(() => request.onsuccess?.())
      return request
    },
  }
}

export type StartLine = { text: string; look?: ParagraphLook }

const START: StartLine[] = [
  { text: "Linh Nguyen", look: { form: { kind: "title" }, align: "center" } },
  { text: "Marketing Intern, Lumière", look: { align: "end" } },
  { text: "Available from June 2026", look: { align: "justify" } },
  { text: "Education", look: { form: { kind: "heading", level: 1 } } },
]

export function insertAt(
  lines: readonly { handle: string }[],
  after: string | null,
  added: ReadonlySet<string>
) {
  let at =
    after === null ? 0 : lines.findIndex((line) => line.handle === after) + 1
  while (lines[at] && added.has(lines[at]?.handle ?? "")) at += 1
  return at
}

export function carriedLook(
  lines: readonly Line[],
  after: string | null,
  text: string
): ParagraphLook | undefined {
  if (after === null) return undefined
  const line = lines.find((line) => line.handle === after)
  const look = line?.look
  if (!look) return undefined
  const marks = look.endMarks ?? look.marks?.at(-1) ?? []
  return {
    ...look,
    marks: Array.from({ length: text.length }, () => marks),
    endMarks: marks,
  }
}

function rewrittenLook(line: Line, text: string): ParagraphLook | undefined {
  const look = line.look
  if (!look?.marks) return look
  let head = 0
  while (
    head < line.text.length &&
    head < text.length &&
    line.text[head] === text[head]
  )
    head++
  let tail = 0
  while (
    tail < line.text.length - head &&
    tail < text.length - head &&
    line.text.at(-tail - 1) === text.at(-tail - 1)
  )
    tail++
  const typed = look.marks[Math.max(0, head - 1)] ?? look.endMarks ?? []
  const marks = Array.from({ length: text.length }, (_, index) =>
    index < head
      ? (look.marks?.[index] ?? [])
      : index >= text.length - tail
        ? (look.marks?.[line.text.length - (text.length - index)] ?? [])
        : typed
  )
  return { ...look, marks, endMarks: marks.at(-1) ?? look.endMarks ?? [] }
}

export function landed(lines: readonly Line[], ops: readonly Op[]): Line[] {
  let out = lines.map((line) => ({ ...line }))
  const added = new Set<string>()
  for (const op of ops) {
    if (op.op === "insert") {
      const handle = `landed-${added.size}`
      const look = carriedLook(out, op.after, op.text)
      out.splice(insertAt(out, op.after, added), 0, {
        handle,
        text: op.text,
        version: -1,
        by: "page",
        ...(look ? { look } : {}),
      })
      added.add(handle)
    } else if (op.op === "delete")
      out = out.filter((line) => line.handle !== op.handle)
    else
      out = out.map((line) =>
        line.handle === op.handle
          ? { ...line, text: op.text, look: rewrittenLook(line, op.text) }
          : line
      )
  }
  return out
}

export function paragraphsOf(lines: readonly Line[]) {
  return lines.map((line) => ({
    handle: line.handle,
    text: line.text,
    pieces:
      line.text === ""
        ? [{ text: "", editable: true, marks: line.look?.endMarks ?? [] }]
        : Array.from({ length: line.text.length }, (_, index) => ({
            text: line.text[index] ?? "",
            editable: true,
            marks: line.look?.marks?.[index] ?? [],
          })),
    held: false,
    message: "",
    code: null,
    ...(line.look?.form ? { form: line.look.form } : {}),
    ...(line.look?.align ? { align: line.look.align } : {}),
  }))
}

export class World {
  revision = 0
  handles = 10
  lines: Line[]
  history = new Map<string, Line[]>()
  mode: Mode = "ok"
  online = true
  pending: Pending[] = []
  requests = 0
  base = new Map<string, number>()
  violation: string | null = null

  constructor(start: readonly StartLine[] = START) {
    this.lines = start.map((line, index) => ({
      handle: handleName(index + 1),
      text: line.text,
      version: 0,
      by: "other",
      ...(line.look ? { look: line.look } : {}),
    }))
    this.history.set(revisionName(0), this.snapshot())
  }

  snapshot() {
    return this.lines.map((line) => ({ ...line }))
  }

  head() {
    return revisionName(this.revision)
  }

  page(): WordPage {
    return {
      doc: docId(),
      revision: this.head(),
      name: "Page.docx",
      label: "cv",
      paragraphs: paragraphsOf(this.lines),
    } as unknown as WordPage
  }

  pageAt(lines: readonly Line[], revision: string): WordPage {
    return {
      doc: docId(),
      revision,
      name: "Page.docx",
      label: "cv",
      paragraphs: paragraphsOf(lines),
    } as unknown as WordPage
  }

  authors: Author[] = ["other"]

  onlyPageWroteSince(from: string, to: string) {
    const index = (name: string) => Number(name.slice(-12))
    return this.authors
      .slice(index(from) + 1, index(to) + 1)
      .every((author) => author === "page")
  }

  bump(author: Author) {
    this.authors.push(author)
    this.revision += 1
    for (const line of this.lines)
      if (line.version === -1) {
        line.version = this.revision
        line.by = author
      }
    this.history.set(this.head(), this.snapshot())
  }

  touch(line: Line) {
    line.version = -1
  }

  elsewhere(pick: number, change: "edit" | "delete" | "rename") {
    if (change === "rename") return
    const line = this.lines[pick % this.lines.length]
    if (!line) return
    if (change === "delete" && this.lines.length > 1) {
      this.lines = this.lines.filter((item) => item !== line)
    } else {
      line.text = `${line.text}~`
      this.touch(line)
    }
    this.bump("other")
  }

  pageFailure(reads: boolean): ApiError | null {
    if (this.mode === "ok") return null
    const mode = PAGE_MODES[this.mode]
    if (reads && !mode.reads) return null
    return new ApiError(
      mode.status,
      mode.code,
      "message" in mode ? mode.message : "No."
    )
  }

  transport(fault: Fault): Error | null {
    if (!this.online || fault === "offline") {
      this.online = false
      return new TypeError("Failed to fetch")
    }
    if (fault === "busy429" || fault === "busy503")
      return new ApiError(
        fault === "busy429" ? 429 : 503,
        "BUSY",
        "The server is busy.",
        {
          retryAfterMs: 2000,
        }
      )
    if (fault === "timeout")
      return new DOMException("The operation timed out.", "TimeoutError")
    return null
  }

  read(signal: AbortSignal): Promise<unknown> {
    return new Promise((resolve, reject) => {
      this.pending.push({
        kind: "read",
        answer: (fault) => {
          if (signal.aborted)
            return reject(new DOMException("aborted", "AbortError"))
          const failure =
            this.transport(fault === "lost" ? "none" : fault) ??
            this.pageFailure(true)
          if (failure) return reject(failure)
          resolve(this.page())
        },
      })
    })
  }

  receipts = new Map<string, { input: string; receipt: unknown }>()

  send(input: unknown, key = crypto.randomUUID()): Promise<unknown> {
    return new Promise((resolve, reject) => {
      this.pending.push({
        kind: "send",
        answer: (fault) => {
          const failure = this.transport(fault === "lost" ? "none" : fault)
          if (failure) return reject(failure)
          const replay = this.receipts.get(key)
          if (replay) {
            if (replay.input !== JSON.stringify(input))
              return reject(
                new ApiError(
                  409,
                  "IDEMPOTENCY_CONFLICT",
                  "Original input changed"
                )
              )
            return resolve(structuredClone(replay.receipt))
          }
          const refused = this.pageFailure(false)
          if (refused) return reject(refused)
          const batch = (input as { batch: { basedOn: string; ops: Op[] } })
            .batch
          if (batch.basedOn !== this.head()) {
            count("stale")
            return reject(new ApiError(409, "CONFLICT", STALE))
          }
          const reason = batch.ops.map((op) => this.refusal(op)).find(Boolean)
          if (reason) {
            count("line refused")
            return reject(new ApiError(409, "CONFLICT", reason))
          }
          count("applied")
          this.apply(batch.ops)
          const receipt = {
            generation: "package",
            docId: docId(),
            revision: this.head(),
            name: "Page.docx",
            kind: "cv",
            packageHash: HASH,
            byteSize: 128,
            incarnation: PACKAGE,
            restore: null,
            activity: crypto.randomUUID(),
          }
          this.receipts.set(key, { input: JSON.stringify(input), receipt })
          if (fault === "lost") return reject(new TypeError("Failed to fetch"))
          resolve(structuredClone(receipt))
        },
      })
    })
  }

  refusal(op: Op): string | null {
    if (op.op === "delete") {
      const line = this.lines.find((item) => item.handle === op.handle)
      return line?.text.includes("†") ? KEPT_WHOLE : null
    }
    for (const [mark, reason] of Object.entries(REASONS))
      if (op.text.includes(mark)) return reason
    return null
  }

  apply(ops: Op[]) {
    const added = new Set<string>()
    for (const op of ops) {
      if (op.op === "insert") {
        this.handles += 1
        const handle = handleName(this.handles)
        const look = carriedLook(this.lines, op.after, op.text)
        this.lines.splice(insertAt(this.lines, op.after, added), 0, {
          handle,
          text: op.text,
          version: -1,
          by: "page",
          ...(look ? { look } : {}),
        })
        added.add(handle)
        continue
      }
      const line = this.lines.find((item) => item.handle === op.handle)
      if (!line) {
        this.violation ??= `the page wrote to a line the server does not have: ${op.handle}`
        continue
      }
      if (
        line.by === "other" &&
        !((this.base.get(line.handle) ?? -2) >= line.version)
      )
        this.violation ??= `I2 never over newer: the page ${op.op === "delete" ? "deleted" : "rewrote"} "${line.text}", changed elsewhere at r${line.version}, while the person's text was based on r${this.base.get(line.handle) ?? "none"}`
      if (op.op === "delete")
        this.lines = this.lines.filter((item) => item !== line)
      else {
        line.look = rewrittenLook(line, op.text)
        line.text = op.text
        this.touch(line)
      }
    }
    this.bump("page")
  }

  answer(pick: number, fault: Fault) {
    const index = pick % this.pending.length
    const [request] = this.pending.splice(index, 1)
    if (!request) return
    this.requests += 1
    request.answer(fault)
  }
}
