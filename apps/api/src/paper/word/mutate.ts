import { createRequire } from "node:module"

import type {
  WordHandle,
  WordOp,
  WordReason,
  WordRefusal,
} from "@workspace/domain"

import { contentOf, paragraphsOf, type WordParagraphView } from "./classify.js"

type CanvasEdit =
  | { op: "writeText"; paragraph: string; text: string }
  | { op: "split"; paragraph: string; at: number }
  | { op: "mergePrevious" | "deleteParagraph"; paragraph: string }

export type WordSide = {
  version: 2
  paragraphs: { key: string; ordinal: number; textIds: string[] }[]
}

export type WordDraft = {
  refused: false
  bytes: Uint8Array
  sidecar: WordSide
}

const canvas = createRequire(import.meta.url)(
  "../../../../../scripts/lib/paper-canvas-bytes.mjs"
) as {
  mintBlankBytes: () => Uint8Array
  applyCanvasBytes: (
    bytes: Uint8Array,
    edit: CanvasEdit,
    side: WordSide
  ) => {
    status: string
    bytes: Uint8Array
    sidecar: WordSide
    message?: string
  }
}

export function refuse(
  reason: WordReason,
  message: string,
  handle: WordHandle | null = null,
  code: string | null = null
): WordRefusal {
  return { refused: true, reason, message, code, handle }
}

const canvasRefusals: Record<
  string,
  { reason: WordReason; message: string; code: string }
> = {
  numbering: {
    reason: "held",
    message: "This paragraph is numbered. Paper will not change it.",
    code: "NUMBERING",
  },
  mark: {
    reason: "held",
    message: "This paragraph has a change mark. Paper will not change it.",
    code: "CHANGE_MARK",
  },
  styles: {
    reason: "held",
    message: "This page mixes paragraph styles. Paper will not change it.",
    code: "STYLES",
  },
  missing: {
    reason: "stale",
    message: "That paragraph is not on this page. Read it again.",
    code: "MISSING_PARAGRAPH",
  },
  write: {
    reason: "order",
    message: "Paper can only put first words on an empty line of this page.",
    code: "FIRST_WORDS_ONLY",
  },
  empty: {
    reason: "order",
    message: "Paper can only remove an empty line of this page.",
    code: "NOT_EMPTY",
  },
  merge: {
    reason: "order",
    message: "Paper can only join a line with words to the line before it.",
    code: "JOIN",
  },
  caret: {
    reason: "order",
    message: "Paper can only split a line inside its words.",
    code: "SPLIT",
  },
}

function fromCanvas(
  result: ReturnType<typeof canvas.applyCanvasBytes>,
  handle: WordHandle
): WordDraft | WordRefusal {
  if (result.status === "APPLIED")
    return {
      refused: false,
      bytes: result.bytes,
      sidecar: {
        version: 2,
        paragraphs: result.sidecar.paragraphs.map((row) => ({
          key: row.key,
          ordinal: row.ordinal,
          textIds: [...row.textIds],
        })),
      },
    }
  const known = canvasRefusals[result.message ?? ""]
  if (known) return refuse(known.reason, known.message, handle, known.code)
  return refuse(
    "closed",
    "This page cannot be changed safely. No document was changed.",
    handle,
    "PACKAGE_SHAPE"
  )
}

function screen(side: WordSide, ops: readonly WordOp[]): WordRefusal | null {
  const keys = new Set(side.paragraphs.map((row) => row.key))
  const touched = new Set<string>()
  const removed = new Set<string>()
  for (const op of ops) {
    const handle = op.op === "insert" ? op.after : op.handle
    if (handle === null) continue
    if (!keys.has(handle))
      return refuse(
        "stale",
        "That paragraph is not on this page. Read it again.",
        handle,
        "MISSING_PARAGRAPH"
      )
    if (removed.has(handle))
      return refuse(
        "order",
        "This edit uses a paragraph it already removed.",
        handle,
        "REMOVED_IN_BATCH"
      )
    if (op.op === "insert") continue
    if (touched.has(handle))
      return refuse(
        "order",
        "This edit changes the same paragraph twice.",
        handle,
        "TWICE"
      )
    touched.add(handle)
    if (op.op === "delete") removed.add(handle)
  }
  return null
}

function textAt(
  side: WordSide,
  views: readonly WordParagraphView[],
  handle: string
) {
  const index = side.paragraphs.findIndex((row) => row.key === handle)
  const view = views[index]
  return view ? { index, text: contentOf(view) } : null
}

export function blankPageBytes() {
  return canvas.mintBlankBytes()
}

export function mutateMinted(
  bytes: Uint8Array,
  side: WordSide,
  ops: readonly WordOp[]
): WordDraft | WordRefusal {
  const screened = screen(side, ops)
  if (screened) return screened
  const views = paragraphsOf(bytes)
  if (views.length !== side.paragraphs.length)
    return refuse(
      "closed",
      "This page cannot be read safely. No document was changed.",
      null,
      "SIDECAR"
    )
  const run = (edit: CanvasEdit, handle: WordHandle) =>
    fromCanvas(canvas.applyCanvasBytes(bytes, edit, side), handle)
  const [first, second] = ops
  if (ops.length === 1 && first?.op === "setText")
    return run(
      { op: "writeText", paragraph: first.handle, text: first.text },
      first.handle
    )
  if (ops.length === 1 && first?.op === "delete")
    return run({ op: "deleteParagraph", paragraph: first.handle }, first.handle)
  if (
    ops.length === 2 &&
    first?.op === "setText" &&
    second?.op === "insert" &&
    second.after === first.handle
  ) {
    const kept = textAt(side, views, first.handle)
    if (kept?.text !== first.text + second.text)
      return refuse(
        "order",
        "A split keeps every word of the line, in order.",
        first.handle,
        "SPLIT"
      )
    return run(
      { op: "split", paragraph: first.handle, at: [...first.text].length },
      first.handle
    )
  }
  if (ops.length === 2 && first?.op === "setText" && second?.op === "delete") {
    const kept = textAt(side, views, first.handle)
    const joined = textAt(side, views, second.handle)
    if (!kept || !joined || joined.index !== kept.index + 1)
      return refuse(
        "order",
        "A join removes the line right after the one it keeps.",
        second.handle,
        "JOIN"
      )
    if (first.text !== kept.text + joined.text)
      return refuse(
        "order",
        "A join keeps every word of both lines, in order.",
        first.handle,
        "JOIN"
      )
    return run({ op: "mergePrevious", paragraph: second.handle }, second.handle)
  }
  return refuse(
    "order",
    "Paper cannot save this change to a blank page yet. No document was changed.",
    null,
    "BATCH_SHAPE"
  )
}
