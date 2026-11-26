import { createRequire } from "node:module"

import { decodeWordText, type WordLine, type WordRun } from "./classify.js"

const canvas = createRequire(import.meta.url)(
  "../../../../../../scripts/lib/paper-canvas-bytes.mjs"
) as { escapeText: (text: string) => string }

export type WordSpan = {
  start: number
  end: number
  text: string
  lean: "before" | "after"
  keptBefore?: number
}

export function letters(text: string) {
  return [...text]
}

export function changedSpan(before: string, after: string): WordSpan {
  const left = letters(before)
  const right = letters(after)
  const shortest = Math.min(left.length, right.length)
  let prefix = 0
  while (prefix < shortest && left[prefix] === right[prefix]) prefix += 1
  let suffix = 0
  while (
    suffix < shortest - prefix &&
    left[left.length - 1 - suffix] === right[right.length - 1 - suffix]
  )
    suffix += 1
  return {
    start: left.slice(0, prefix).join("").length,
    end: left.slice(0, left.length - suffix).join("").length,
    text: right.slice(prefix, right.length - suffix).join(""),
    lean: "before",
  }
}

export function caretSpan(
  before: string,
  after: string,
  caret: number
): WordSpan | null {
  if (caret > after.length) return null
  const left = letters(before)
  const right = letters(after)
  const typedUpTo = letters(after.slice(0, caret)).length
  const tailRoom = Math.min(right.length - typedUpTo, left.length)
  let suffix = 0
  while (
    suffix < tailRoom &&
    left[left.length - 1 - suffix] === right[right.length - 1 - suffix]
  )
    suffix += 1
  const headRoom = Math.min(
    typedUpTo,
    left.length - suffix,
    right.length - suffix
  )
  let prefix = 0
  while (prefix < headRoom && left[prefix] === right[prefix]) prefix += 1
  return {
    start: left.slice(0, prefix).join("").length,
    end: left.slice(0, left.length - suffix).join("").length,
    text: right.slice(prefix, right.length - suffix).join(""),
    lean: "before",
  }
}

export function splitPoint(
  before: string,
  left: string,
  right: string
): number | null {
  const text = letters(before)
  const head = letters(left)
  const tail = letters(right)
  if (text.length === 0) return head.length + tail.length === 0 ? 0 : null
  let prefix = 0
  while (
    prefix < Math.min(text.length, head.length) &&
    text[prefix] === head[prefix]
  )
    prefix += 1
  let suffix = 0
  while (
    suffix < Math.min(text.length, tail.length) &&
    text[text.length - 1 - suffix] === tail[tail.length - 1 - suffix]
  )
    suffix += 1
  return prefix + suffix >= text.length ? prefix : null
}

export function joinsAt(
  kept: string,
  joined: string,
  text: string,
  caret: number | null
) {
  const whole = kept + joined
  if (text === whole) return true
  const change =
    caret === null ? changedSpan(whole, text) : caretSpan(whole, text, caret)
  return !!change && change.start <= kept.length && change.end >= kept.length
}

export function typedSpan(
  before: string,
  after: string,
  caret: number | null,
  lean: WordSpan["lean"] | null,
  keptBefore: number | null
): WordSpan | null {
  const span =
    caret === null
      ? changedSpan(before, after)
      : caretSpan(before, after, caret)
  if (!span) return null
  return {
    ...span,
    ...(lean ? { lean } : {}),
    ...(keptBefore === null ? {} : { keptBefore }),
  }
}

function rawWith(raw: string, before: string, after: string) {
  const change = changedSpan(before, after)
  const bounds = new Map([[0, 0]])
  let length = 0
  for (const match of raw.matchAll(/&[^;]+;|\r\n?|[\s\S]/gu)) {
    length += decodeWordText(match[0]).length
    bounds.set(length, match.index + match[0].length)
  }
  const start = bounds.get(change.start)
  const end = bounds.get(change.end)
  if (start === undefined || end === undefined) return null
  return raw.slice(0, start) + canvas.escapeText(change.text) + raw.slice(end)
}

function headWith(head: string, text: string) {
  if (!text.startsWith(" ") && !text.endsWith(" ")) return head
  const space = /(\s)xml:space=(["'])[^"']*\2/
  if (space.test(head)) return head.replace(space, '$1xml:space="preserve"')
  const at = head.length - 1
  return head.slice(0, at) + ' xml:space="preserve"' + head.slice(at)
}

export function rebuiltRun(run: WordRun, text: string): WordRun {
  if (text === run.text) return run
  const space = /^\s|\s$/.test(text) ? ' xml:space="preserve"' : ""
  return {
    xml: `${run.open}${run.props}<w:t${space}>${canvas.escapeText(text)}</w:t></w:r>`,
    open: run.open,
    props: run.props,
    text,
    body: null,
    origin: run.origin,
  }
}

export function editedRun(run: WordRun, text: string): WordRun {
  if (text === run.text) return run
  const body = run.body
  const raw = body ? rawWith(body.raw, run.text, text) : null
  if (!body || raw === null) return rebuiltRun(run, text)
  const head = headWith(body.head, text)
  return {
    ...run,
    xml: body.lead + head + raw + body.trail,
    text,
    body: { ...body, head, raw },
  }
}

export function runsOf(line: WordLine) {
  return line.parts.flatMap((part) => (part.run ? [part.run] : []))
}

export function lineWith(
  open: string,
  props: string,
  runs: WordRun[]
): WordLine {
  return {
    open,
    props,
    parts: runs.map((run) => ({ run, kept: null })),
    text: runs.map((run) => run.text).join(""),
    shape: null,
    origin: null,
  }
}

export function lineXml(line: WordLine) {
  const origin = line.origin
  if (!origin)
    return `${line.open}${line.props}${line.parts.map((part) => (part.run ? part.run.xml : part.kept.xml)).join("")}</w:p>`
  let xml = origin.xml
  for (const run of runsOf(line).reverse()) {
    if (!run.origin) continue
    xml =
      xml.slice(0, run.origin.start - origin.start) +
      run.xml +
      xml.slice(run.origin.end - origin.start)
  }
  return line.open + xml.slice(origin.open.length)
}

export function plainRun(text: string): WordRun {
  const space = /^\s|\s$/.test(text) ? ' xml:space="preserve"' : ""
  return {
    xml: `<w:r><w:t${space}>${canvas.escapeText(text)}</w:t></w:r>`,
    open: "<w:r>",
    props: "",
    text,
    body: null,
    origin: null,
  }
}
