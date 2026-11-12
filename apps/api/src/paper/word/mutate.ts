import { createHash, randomUUID } from "node:crypto"
import { createRequire } from "node:module"

import type {
  WordHandle,
  WordOp,
  WordReason,
  WordRefusal,
} from "@workspace/domain"

import {
  joinsAt,
  lineWith,
  lineXml,
  plainRun,
  rebuiltRun,
  runsOf,
  splitPoint,
  typedSpan,
  type WordSpan,
} from "./runs.js"
import {
  classifyParagraph,
  paragraphsOf,
  type WordDisposition,
  type WordLine,
} from "./classify.js"
import { rewrite, splitLine } from "./line-spans.js"

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
  repack: (bytes: Uint8Array, xml: string) => Uint8Array
  escapeText: (text: string) => string
}

export function refuse(
  reason: WordReason,
  message: string,
  handle: WordHandle | null = null,
  code: string | null = null
): WordRefusal {
  return { refused: true, reason, message, code, handle }
}

type Entry = {
  handle: WordHandle | null
  key: string
  textIds: string[]
  gap: string
  xml: string
  disposition: WordDisposition
  nested: boolean
}

type Page = { entries: Entry[]; tail: string }

export type WordSpans = ReadonlyMap<WordHandle, readonly WordSpan[]>

type Step =
  | {
      kind: "setText"
      handle: WordHandle
      text: string
      spans: readonly WordSpan[] | null
      caret: number | null
      lean: WordSpan["lean"] | null
      keptBefore: number | null
    }
  | { kind: "delete"; handle: WordHandle }
  | { kind: "insert"; after: WordHandle | null; text: string }
  | {
      kind: "split"
      handle: WordHandle
      at: number
      left: string
      right: string
    }
  | {
      kind: "join"
      handle: WordHandle
      joined: WordHandle
      text: string
      caret: number | null
      lean: WordSpan["lean"] | null
      keptBefore: number | null
    }

const unsafe = () =>
  refuse(
    "closed",
    "This page cannot be changed safely. No document was changed.",
    null,
    "PACKAGE_SHAPE"
  )

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

function textOf(disposition: WordDisposition) {
  if (disposition.kind === "line") return disposition.line.text
  if (disposition.kind === "held") return disposition.text
  return ""
}

function lineEntry(entry: Entry, line: WordLine): Entry {
  return {
    ...entry,
    xml: lineXml(line),
    disposition: { kind: "line", line },
  }
}

const textVersion = /(\sw14:textId=)(["'])([0-9A-Fa-f]{8})\2/

function versionName(value: number) {
  return value.toString(16).toUpperCase().padStart(8, "0")
}

function revisedEntry(entry: Entry, line: WordLine): Entry | WordRefusal {
  if (!textVersion.test(line.open)) return lineEntry(entry, line)
  if (entry.textIds.length >= 4096) return unsafe()
  const used = new Set(entry.textIds.map((id) => id.toUpperCase()))
  let value =
    createHash("sha256")
      .update(JSON.stringify([entry.key, entry.textIds, line.text]))
      .digest()
      .readUInt32BE(0) & 0x7fffffff
  while (!value || used.has(versionName(value)))
    value = (value + 1) & 0x7fffffff
  const textId = versionName(value)
  return lineEntry(
    { ...entry, textIds: [...entry.textIds, textId] },
    { ...line, open: line.open.replace(textVersion, `$1$2${textId}$2`) }
  )
}

function heldRefusal(entry: Entry, handle: WordHandle): WordRefusal | null {
  const disposition = entry.disposition
  if (disposition.kind === "line") return null
  if (disposition.kind === "carrier")
    return refuse(
      "held",
      "This line ends a page section. Paper will not change it.",
      handle,
      "SECTION"
    )
  return refuse("held", disposition.message, handle, disposition.code)
}

function shapeRefusal(entry: Entry, handle: WordHandle): WordRefusal | null {
  const shape =
    entry.disposition.kind === "line" ? entry.disposition.line.shape : null
  return shape ? refuse("held", shape.message, handle, shape.code) : null
}

function rewritten(
  line: WordLine,
  changes: readonly WordSpan[],
  text: string,
  handle: WordHandle
): WordLine | WordRefusal {
  const written = rewrite(line, changes)
  if (written === "SPANS") return unsafe()
  if (written === "CARET") return caretOutside(handle)
  if (written === "HELD_GAP")
    return refuse(
      "held",
      "Part of this line is kept exactly as it is in Word, such as a link or a break. Paper will not move words across it. No document was changed.",
      handle,
      "HELD_GAP"
    )
  if (written === "MIXED_FORMAT")
    return refuse(
      "held",
      "This line mixes formatting, such as bold or a different font. Paper will not rewrite words across that formatting. No document was changed.",
      handle,
      "MIXED_FORMAT"
    )
  return written.text === text ? written : unsafe()
}

const caretOutside = (handle: WordHandle) =>
  refuse(
    "plain",
    "The caret is outside this line's words. No document was changed.",
    handle,
    "CARET"
  )

function plan(
  entries: Entry[],
  ops: readonly WordOp[],
  spans: WordSpans
): Step[] | WordRefusal {
  const find = (handle: WordHandle) =>
    entries.findIndex((entry) => entry.handle === handle)
  const steps: Step[] = []
  for (let at = 0; at < ops.length; at += 1) {
    const op = ops[at] as WordOp
    const next = ops[at + 1]
    if (op.op === "insert") {
      steps.push({ kind: "insert", after: op.after, text: op.text })
      continue
    }
    const splitting =
      op.op === "setText" && next?.op === "insert" && next.after === op.handle
        ? entries[find(op.handle)]
        : undefined
    const cut =
      op.op === "setText" && next?.op === "insert" && splitting
        ? splitPoint(textOf(splitting.disposition), op.text, next.text)
        : null
    if (
      op.op === "setText" &&
      next?.op === "insert" &&
      splitting &&
      cut !== null
    ) {
      const blocked =
        heldRefusal(splitting, op.handle) ?? shapeRefusal(splitting, op.handle)
      if (blocked) return blocked
      steps.push({
        kind: "split",
        handle: op.handle,
        at: cut,
        left: op.text,
        right: next.text,
      })
      at += 1
      continue
    }
    if (op.op === "setText" && next?.op === "delete") {
      const kept = entries[find(op.handle)]
      const joined = entries[find(next.handle)]
      if (
        kept &&
        joined &&
        find(next.handle) === find(op.handle) + 1 &&
        textOf(joined.disposition) !== "" &&
        joinsAt(
          textOf(kept.disposition),
          textOf(joined.disposition),
          op.text,
          op.caret ?? null
        )
      ) {
        steps.push({
          kind: "join",
          handle: op.handle,
          joined: next.handle,
          text: op.text,
          caret: op.caret ?? null,
          lean: op.lean ?? null,
          keptBefore: op.keptBefore ?? null,
        })
        at += 1
        continue
      }
    }
    steps.push(
      op.op === "setText"
        ? {
            kind: "setText",
            handle: op.handle,
            text: op.text,
            spans: spans.get(op.handle) ?? null,
            caret: op.caret ?? null,
            lean: op.lean ?? null,
            keptBefore: op.keptBefore ?? null,
          }
        : { kind: "delete", handle: op.handle }
    )
  }
  return steps
}

function addedEntry(line: WordLine, gap: string): Entry {
  return lineEntry(
    {
      handle: null,
      key: randomUUID(),
      textIds: [],
      gap,
      xml: "",
      disposition: { kind: "line", line },
      nested: false,
    },
    line
  )
}

function following(entries: Entry[], from: number) {
  let at = from
  while (entries[at] && (entries[at]?.nested || entries[at]?.handle === null))
    at += 1
  return at
}

function inserted(
  page: Page,
  step: Extract<Step, { kind: "insert" }>
): Page | WordRefusal {
  const { entries, tail } = page
  if (step.after === null) {
    const at = following(entries, 0)
    const added = lineWith("<w:p>", "", [plainRun(step.text)])
    if (at > 0)
      return {
        entries: [
          ...entries.slice(0, at),
          addedEntry(added, ""),
          ...entries.slice(at),
        ],
        tail,
      }
    const first = entries[0]
    if (!first) return unsafe()
    const body = /<w:body\b[^>]*>/.exec(first.gap)
    if (!body) return unsafe()
    const cut = body.index + body[0].length
    return {
      entries: [
        addedEntry(added, first.gap.slice(0, cut)),
        { ...first, gap: first.gap.slice(cut) },
        ...entries.slice(1),
      ],
      tail,
    }
  }
  const index = entries.findIndex((entry) => entry.handle === step.after)
  const entry = entries[index]
  if (!entry) return unsafe()
  const blocked =
    heldRefusal(entry, step.after) ?? shapeRefusal(entry, step.after)
  if (blocked) return blocked
  if (entry.disposition.kind !== "line") return unsafe()
  const line = entry.disposition.line
  const source = runsOf(line)[0]
  const added = lineWith("<w:p>", line.props, [
    source ? rebuiltRun(source, step.text) : plainRun(step.text),
  ])
  const at = following(entries, index + 1)
  return {
    entries: [
      ...entries.slice(0, at),
      addedEntry(added, ""),
      ...entries.slice(at),
    ],
    tail,
  }
}

function run(page: Page, step: Step): Page | WordRefusal {
  if (step.kind === "insert") return inserted(page, step)
  const { entries, tail } = page
  const index = entries.findIndex((entry) => entry.handle === step.handle)
  const entry = entries[index]
  if (!entry) return unsafe()
  const blocked = heldRefusal(entry, step.handle)
  if (blocked) return blocked
  if (entry.disposition.kind !== "line") return unsafe()
  const line = entry.disposition.line
  const before = entries.slice(0, index)
  const after = entries.slice(index + 1)
  if (step.kind === "setText") {
    if (step.text === line.text && !step.spans) return page
    const typed = typedSpan(
      line.text,
      step.text,
      step.caret,
      step.lean,
      step.keptBefore
    )
    if (!typed) return caretOutside(step.handle)
    const written = rewritten(
      line,
      step.spans ?? [typed],
      step.text,
      step.handle
    )
    if ("refused" in written) return written
    if (written.parts.every((part, at) => part === line.parts[at])) return page
    const revised = revisedEntry(entry, written)
    if ("refused" in revised) return revised
    return { entries: [...before, revised, ...after], tail }
  }
  const shaped = shapeRefusal(entry, step.handle)
  if (shaped) return shaped
  if (step.kind === "delete") {
    if (
      !entries.some(
        (other, at) => at !== index && other.disposition.kind === "line"
      )
    )
      return refuse(
        "order",
        "Paper will not remove the last line of the page. Clear its words instead. No document was changed.",
        step.handle,
        "LAST_PARAGRAPH"
      )
    const [following, ...rest] = after
    if (!following) return { entries: before, tail: entry.gap + tail }
    return {
      entries: [
        ...before,
        { ...following, gap: entry.gap + following.gap },
        ...rest,
      ],
      tail,
    }
  }
  if (step.kind === "split") {
    const [cutLeft, cutRight] = splitLine(line, step.at)
    const left =
      step.left === cutLeft.text
        ? cutLeft
        : rewritten(
            cutLeft,
            [
              {
                start: cutLeft.text.length,
                end: cutLeft.text.length,
                text: step.left.slice(cutLeft.text.length),
                lean: "before",
              },
            ],
            step.left,
            step.handle
          )
    if ("refused" in left) return left
    const right =
      step.right === cutRight.text
        ? cutRight
        : rewritten(
            cutRight,
            [
              {
                start: 0,
                end: 0,
                text: step.right.slice(
                  0,
                  step.right.length - cutRight.text.length
                ),
                lean: "after",
              },
            ],
            step.right,
            step.handle
          )
    if ("refused" in right) return right
    const added: Entry = {
      handle: null,
      key: randomUUID(),
      textIds: [],
      gap: "",
      xml: "",
      disposition: entry.disposition,
      nested: false,
    }
    return {
      entries: [
        ...before,
        lineEntry(entry, left),
        lineEntry(added, right),
        ...after,
      ],
      tail,
    }
  }
  const [joined, ...rest] = after
  if (!joined || joined.handle !== step.joined) return unsafe()
  const blockedJoin =
    heldRefusal(joined, step.joined) ?? shapeRefusal(joined, step.joined)
  if (blockedJoin) return blockedJoin
  if (joined.disposition.kind !== "line") return unsafe()
  if (joined.gap.trim() !== "")
    return refuse(
      "order",
      "These two lines are not next to each other in the Word file. No document was changed.",
      step.joined,
      "JOIN"
    )
  const merged = lineWith(line.open, line.props, [
    ...runsOf(line),
    ...runsOf(joined.disposition.line),
  ])
  const typed = typedSpan(
    merged.text,
    step.text,
    step.caret,
    step.lean,
    step.keptBefore
  )
  if (!typed) return caretOutside(step.handle)
  const result =
    step.text === merged.text
      ? merged
      : rewritten(merged, [typed], step.text, step.handle)
  if ("refused" in result) return result
  return {
    entries: [...before, lineEntry(entry, result), ...rest],
    tail,
  }
}

function sameDisposition(left: WordDisposition, right: WordDisposition) {
  if (left.kind !== right.kind) return false
  if (left.kind === "held" && right.kind === "held")
    return left.code === right.code && left.text === right.text
  return textOf(left) === textOf(right)
}

export function blankPageBytes() {
  return canvas.mintBlankBytes()
}

export function mutateWord(
  bytes: Uint8Array,
  side: WordSide,
  ops: readonly WordOp[],
  spans: WordSpans = new Map()
): WordDraft | WordRefusal {
  const screened = screen(side, ops)
  if (screened) return screened
  const views = paragraphsOf(bytes)
  const outer = views.filter((view) => !view.nested)
  const lastView = outer.at(-1)
  if (views.length !== side.paragraphs.length || !lastView)
    return refuse(
      "closed",
      "This page cannot be read safely. No document was changed.",
      null,
      "SIDECAR"
    )
  const xml = lastView.xml
  let reached = 0
  const entries: Entry[] = views.map((view, index) => {
    const row = side.paragraphs[index] as WordSide["paragraphs"][number]
    const gap = view.nested ? "" : xml.slice(reached, view.node.start)
    if (!view.nested) reached = view.node.end
    return {
      handle: row.key,
      key: row.key,
      textIds: [...row.textIds],
      gap,
      xml: view.nested ? "" : view.slice,
      disposition: classifyParagraph(view),
      nested: view.nested,
    }
  })
  const steps = plan(entries, ops, spans)
  if (!Array.isArray(steps)) return steps
  let page: Page = { entries, tail: xml.slice(reached) }
  for (const step of steps) {
    const next = run(page, step)
    if ("refused" in next) return next
    page = next
  }
  const kept = page.entries
  const document =
    kept.map((entry) => entry.gap + entry.xml).join("") + page.tail
  const packed = canvas.repack(bytes, document)
  const after = paragraphsOf(packed)
  if (
    after.length !== kept.length ||
    after.some(
      (view, index) =>
        !sameDisposition(
          classifyParagraph(view),
          (kept[index] as Entry).disposition
        )
    )
  )
    return unsafe()
  return {
    refused: false,
    bytes: packed,
    sidecar: {
      version: 2,
      paragraphs: kept.map((entry, ordinal) => ({
        key: entry.key,
        ordinal,
        textIds: [...entry.textIds],
      })),
    },
  }
}
