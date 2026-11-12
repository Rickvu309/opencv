import { randomUUID } from "node:crypto"
import { createRequire } from "node:module"

import type {
  WordHandle,
  WordOp,
  WordReason,
  WordRefusal,
} from "@workspace/domain"

import {
  classifyParagraph,
  paragraphsOf,
  type WordDisposition,
  type WordLine,
  type WordRun,
} from "./classify.js"

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
}

type Page = { entries: Entry[]; tail: string }

type Step =
  | { kind: "setText"; handle: WordHandle; text: string }
  | { kind: "delete"; handle: WordHandle }
  | { kind: "split"; handle: WordHandle; at: number }
  | { kind: "join"; handle: WordHandle; joined: WordHandle }

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

function letters(text: string) {
  return [...text]
}

function runWith(run: WordRun, text: string): WordRun {
  if (text === run.text) return run
  const space = /^\s|\s$/.test(text) ? ' xml:space="preserve"' : ""
  return {
    xml: `${run.open}${run.props}<w:t${space}>${canvas.escapeText(text)}</w:t></w:r>`,
    open: run.open,
    props: run.props,
    text,
  }
}

function lineWith(open: string, props: string, runs: WordRun[]): WordLine {
  return { open, props, runs, text: runs.map((run) => run.text).join("") }
}

function lineXml(line: WordLine) {
  return `${line.open}${line.props}${line.runs.map((run) => run.xml).join("")}</w:p>`
}

function spansOf(line: WordLine) {
  let at = 0
  return line.runs.map((run) => {
    const length = letters(run.text).length
    const span = { run, start: at, end: at + length }
    at += length
    return span
  })
}

function rewrite(line: WordLine, next: string): WordLine | null {
  if (next === line.text) return line
  const before = letters(line.text)
  const after = letters(next)
  let prefix = 0
  while (
    prefix < before.length &&
    prefix < after.length &&
    before[prefix] === after[prefix]
  )
    prefix += 1
  let suffix = 0
  while (
    suffix < before.length - prefix &&
    suffix < after.length - prefix &&
    before[before.length - 1 - suffix] === after[after.length - 1 - suffix]
  )
    suffix += 1
  const end = before.length - suffix
  const middle = after.slice(prefix, after.length - suffix).join("")
  const spans = spansOf(line)
  const inside = (index: number) => (index < 0 ? 0 : index)
  const first =
    prefix === end
      ? inside(
          spans.findIndex(
            (span) =>
              span.end >= prefix && (span.start < prefix || prefix === 0)
          )
        )
      : inside(spans.findIndex((span) => span.end > prefix))
  const last =
    prefix === end ? first : spans.findIndex((span) => span.end >= end)
  const opening = spans[first]
  const closing = spans[last]
  if (!opening || !closing) return null
  const covered = spans.slice(first, last + 1)
  if (covered.some((span) => span.run.props !== opening.run.props)) return null
  const text =
    letters(opening.run.text)
      .slice(0, prefix - opening.start)
      .join("") +
    middle +
    letters(closing.run.text)
      .slice(end - closing.start)
      .join("")
  return lineWith(line.open, line.props, [
    ...line.runs.slice(0, first),
    runWith(opening.run, text),
    ...line.runs.slice(last + 1),
  ])
}

function splitLine(line: WordLine, at: number): [WordLine, WordLine] {
  const spans = spansOf(line)
  const index = Math.max(
    0,
    spans.findIndex((span) => at <= span.end)
  )
  const span = spans[index] ?? spans[0]
  if (!span) throw new Error("A line without runs cannot split.")
  const parts = letters(span.run.text)
  const cut = at - span.start
  return [
    lineWith(line.open, line.props, [
      ...line.runs.slice(0, index),
      runWith(span.run, parts.slice(0, cut).join("")),
    ]),
    lineWith("<w:p>", line.props, [
      runWith(span.run, parts.slice(cut).join("")),
      ...line.runs.slice(index + 1),
    ]),
  ]
}

function lineEntry(entry: Entry, line: WordLine): Entry {
  return {
    ...entry,
    xml: lineXml(line),
    disposition: { kind: "line", line },
  }
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

function plan(entries: Entry[], ops: readonly WordOp[]): Step[] | WordRefusal {
  const find = (handle: WordHandle) =>
    entries.findIndex((entry) => entry.handle === handle)
  const steps: Step[] = []
  for (let at = 0; at < ops.length; at += 1) {
    const op = ops[at] as WordOp
    const next = ops[at + 1]
    if (op.op === "insert")
      return refuse(
        "order",
        "Paper adds a line only by splitting one. No document was changed.",
        op.after,
        "SPLIT"
      )
    if (op.op === "setText" && next?.op === "insert") {
      const entry = entries[find(op.handle)]
      if (!entry || next.after !== op.handle)
        return refuse(
          "order",
          "A split adds the new line right after the line it splits.",
          next.after,
          "SPLIT"
        )
      const blocked = heldRefusal(entry, op.handle)
      if (blocked) return blocked
      if (textOf(entry.disposition) !== op.text + next.text)
        return refuse(
          "order",
          "A split keeps every word of the line, in order.",
          op.handle,
          "SPLIT"
        )
      steps.push({
        kind: "split",
        handle: op.handle,
        at: letters(op.text).length,
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
        op.text === textOf(kept.disposition) + textOf(joined.disposition)
      ) {
        steps.push({ kind: "join", handle: op.handle, joined: next.handle })
        at += 1
        continue
      }
    }
    steps.push(
      op.op === "setText"
        ? { kind: "setText", handle: op.handle, text: op.text }
        : { kind: "delete", handle: op.handle }
    )
  }
  return steps
}

function run(page: Page, step: Step): Page | WordRefusal {
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
    const written = rewrite(line, step.text)
    if (!written)
      return refuse(
        "held",
        "This line mixes formatting, such as bold or a different font. Paper will not rewrite words across that formatting. No document was changed.",
        step.handle,
        "MIXED_FORMAT"
      )
    return { entries: [...before, lineEntry(entry, written), ...after], tail }
  }
  if (step.kind === "delete") {
    if (line.text !== "")
      return refuse(
        "order",
        "Paper can only remove an empty line. No document was changed.",
        step.handle,
        "NOT_EMPTY"
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
    const [left, right] = splitLine(line, step.at)
    const added: Entry = {
      handle: null,
      key: randomUUID(),
      textIds: [],
      gap: "",
      xml: "",
      disposition: entry.disposition,
    }
    return {
      entries: [
        ...before,
        lineEntry({ ...entry, key: randomUUID() }, left),
        lineEntry(added, right),
        ...after,
      ],
      tail,
    }
  }
  const [joined, ...rest] = after
  if (!joined || joined.handle !== step.joined) return unsafe()
  const blockedJoin = heldRefusal(joined, step.joined)
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
    ...line.runs,
    ...joined.disposition.line.runs,
  ])
  return {
    entries: [
      ...before,
      lineEntry({ ...entry, key: randomUUID() }, merged),
      ...rest,
    ],
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
  ops: readonly WordOp[]
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
    }
  })
  const steps = plan(entries, ops)
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
