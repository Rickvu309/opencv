import * as Y from "yjs"
import {
  canonical,
  formatChangeSchema,
  formattedDocumentSchema,
  mergeFormatRuns,
  overlay,
  paragraphSchema,
  inlineSchema,
  formatRunsSchema,
  styleSchema,
  type FormatChange,
  type FormatRun,
  type FormatTarget,
  type PrivateFormattedDocument,
  type Result,
} from "@workspace/domain/internal/paper-presentation"
import {
  canonicalTarget,
  resolveFormattingTarget,
  type EngineBinding,
} from "./presentation-binding.js"
import { selectedRuns, textSpans } from "./presentation-inline.js"
import {
  admittedNode,
  attempt,
  openFormattedBinary,
  readFormatting,
} from "./native-formatting.js"

import { engineStyles } from "./native-formatting-styles.js"
import { engineProps, formattingProps } from "./native-formatting-props.js"
import { writePresentationMeta } from "./presentation-meta.js"

export type PreparedFormatting = Readonly<{ kind: "prepared-formatting" }>
export type FormattingReceipt = Readonly<{ kind: "formatting-receipt" }>
type Anchor = {
  target: FormatTarget
  text: Y.XmlText
  start: Y.RelativePosition
  end: Y.RelativePosition
  content: string
}
type Cell = {
  anchor: Anchor
  before: FormatRun
  after: FormatRun
  keys: string[]
}
type Property =
  | {
      scope: "paragraph"
      target: FormatTarget
      before: object
      after: object
      keys: string[]
    }
  | {
      scope: "document"
      section: "page" | "inline" | "paragraph"
      before: object
      after: object
      keys: string[]
    }
  | {
      scope: "style"
      id: string
      index: number
      before: unknown
      after: unknown
      keys: string[]
    }
type Entry =
  { kind: "cells"; cells: Cell[] } | { kind: "property"; property: Property }
type RecordValue = { binding: EngineBinding; entry: Entry; used: boolean }
const prepared = new WeakMap<PreparedFormatting, RecordValue>()
const receipts = new WeakMap<FormattingReceipt, RecordValue>()
function keysOf(values: object): string[] {
  return Object.entries(values)
    .filter(([, v]) => v !== undefined)
    .map(([k]) => k)
}
function equalKeys(current: object, expected: object, keys: readonly string[]) {
  return keys.every(
    (key) =>
      canonical(Reflect.get(current, key)) ===
      canonical(Reflect.get(expected, key))
  )
}
function contentOf(document: PrivateFormattedDocument, target: FormatTarget) {
  const node = canonicalTarget(document, target)
  if (!("content" in node)) throw new Error("Target has no inline content")
  return node
}
function replaceRange(
  runs: FormatRun[],
  from: number,
  to: number,
  values: object
): FormatRun[] {
  selectedRuns(runs, from, to)
  let offset = 0
  return mergeFormatRuns(
    formatRunsSchema.parse(
      runs.flatMap((run) => {
        const start = offset
        offset += run.text.length
        const a = Math.max(from, start),
          b = Math.min(to, offset)
        if (a >= b) return [run]
        return [
          ...(a > start
            ? [{ ...run, text: run.text.slice(0, a - start) }]
            : []),
          {
            ...overlay(run, values),
            text: run.text.slice(a - start, b - start),
          },
          ...(b < offset ? [{ ...run, text: run.text.slice(b - start) }] : []),
        ]
      })
    )
  )
}
function locate(
  binding: EngineBinding,
  document: PrivateFormattedDocument,
  anchor: Anchor
) {
  contentOf(document, anchor.target)
  const content = resolveFormattingTarget(binding, anchor.target).content
  const start = Y.createAbsolutePositionFromRelativePosition(
    anchor.start,
    binding.doc
  )
  const end = Y.createAbsolutePositionFromRelativePosition(
    anchor.end,
    binding.doc
  )
  if (
    !start ||
    !end ||
    start.type !== anchor.text ||
    end.type !== anchor.text ||
    end.index - start.index !== anchor.content.length
  )
    throw new Error("Changed text anchor")
  const span = textSpans(content).find((s) => s.text === start.type)
  if (!span) throw new Error("Anchor left semantic target")
  const from = span.offset + start.index,
    to = span.offset + end.index
  const runs = selectedRuns(
    contentOf(document, anchor.target).content,
    from,
    to
  )
  if (runs.map((r) => r.text).join("") !== anchor.content)
    throw new Error("Anchored text replaced")
  return { from, to, runs }
}
function makeEntry(
  binding: EngineBinding,
  before: PrivateFormattedDocument,
  change: FormatChange
): Entry {
  const keys = keysOf(change.values ?? {})
  if (change.kind === "inline") {
    const { target, from, to } = change.range
    const node = contentOf(before, target)
    const selection = selectedRuns(node.content, from, to)
    if (
      canonical(mergeFormatRuns(selection)) !==
      canonical(mergeFormatRuns(change.expected))
    )
      throw new Error("Stale selected values")
    const spans = textSpans(resolveFormattingTarget(binding, target).content)
    const cells: Cell[] = []
    let at = from
    for (const run of selection)
      for (const char of run.text) {
        const span = spans.find((s) => s.from <= at && s.to >= at + char.length)
        if (!span)
          throw new Error(
            "Formatting a hard break requires an engine split operation"
          )
        const anchor = {
          target,
          text: span.text,
          content: char,
          start: Y.createRelativePositionFromTypeIndex(
            span.text,
            at - span.offset,
            0
          ),
          end: Y.createRelativePositionFromTypeIndex(
            span.text,
            at - span.offset + char.length,
            -1
          ),
        }
        const original = { ...run, text: char }
        const after = formatRunsSchema.parse([
          { ...overlay(original, change.values), text: char },
        ])[0]
        if (!after) throw new Error("Missing changed run")
        cells.push({ anchor, before: original, after, keys })
        at += char.length
      }
    return { kind: "cells", cells }
  }
  if (change.kind === "paragraph") {
    const node = contentOf(before, change.target)
    if (!equalKeys(node.paragraph, change.expected, keys))
      throw new Error("Stale paragraph")
    return {
      kind: "property",
      property: {
        scope: "paragraph",
        target: change.target,
        before: node.paragraph,
        after: paragraphSchema.parse(overlay(node.paragraph, change.values)),
        keys,
      },
    }
  }
  if (change.kind === "named-style") {
    const current =
      before.presentation.styles.find((s) => s.id === change.id) ?? null
    if (
      canonical(current) !== canonical(change.expected) ||
      (change.values && change.values.id !== change.id)
    )
      throw new Error("Stale style identity")
    return {
      kind: "property",
      property: {
        scope: "style",
        id: change.id,
        index: before.presentation.styles.findIndex((s) => s.id === change.id),
        before: current,
        after: change.values,
        keys: [],
      },
    }
  }
  const section =
    change.kind === "document-page"
      ? "page"
      : change.kind === "document-inline"
        ? "inline"
        : "paragraph"
  const current = before.presentation[section]
  if (!equalKeys(current, change.expected, keys))
    throw new Error("Stale document property")
  return {
    kind: "property",
    property: {
      scope: "document",
      section,
      before: current,
      after: overlay(current, change.values),
      keys,
    },
  }
}
function scoped(values: object, keys: readonly string[]) {
  return Object.fromEntries(
    keys.map((key) => [key, Reflect.get(values, key) ?? null])
  )
}
function project(
  binding: EngineBinding,
  document: PrivateFormattedDocument,
  entry: Entry,
  reverse: boolean
) {
  const candidate = structuredClone(document)
  if (entry.kind === "cells")
    for (const cell of entry.cells) {
      const range = locate(binding, document, cell.anchor)
      const expected = reverse ? cell.after : cell.before
      if (!range.runs.every((run) => equalKeys(run, expected, cell.keys)))
        throw new Error("Affected inline property changed")
      const node = contentOf(candidate, cell.anchor.target)
      node.content = replaceRange(
        node.content,
        range.from,
        range.to,
        scoped(reverse ? cell.before : cell.after, cell.keys)
      )
    }
  else {
    const property = entry.property
    const expected = reverse ? property.after : property.before
    const desired = reverse ? property.before : property.after
    if (property.scope === "style") {
      const current =
        candidate.presentation.styles.find((s) => s.id === property.id) ?? null
      if (canonical(current) !== canonical(expected))
        throw new Error("Affected named style changed")
      candidate.presentation.styles = candidate.presentation.styles.filter(
        (s) => s.id !== property.id
      )
      if (desired !== null)
        candidate.presentation.styles.splice(
          property.index < 0
            ? candidate.presentation.styles.length
            : property.index,
          0,
          styleSchema.parse(desired)
        )
    } else {
      const current =
        property.scope === "paragraph"
          ? contentOf(candidate, property.target).paragraph
          : candidate.presentation[property.section]
      if (
        !expected ||
        typeof expected !== "object" ||
        !desired ||
        typeof desired !== "object" ||
        !equalKeys(current, expected, property.keys)
      )
        throw new Error("Affected property changed")
      const updated = overlay(current, scoped(desired, property.keys))
      if (property.scope === "paragraph")
        contentOf(candidate, property.target).paragraph =
          paragraphSchema.parse(updated)
      else
        Object.assign(candidate.presentation, { [property.section]: updated })
    }
  }
  return formattedDocumentSchema.parse(candidate)
}
function writeEntry(
  binding: EngineBinding,
  candidate: PrivateFormattedDocument,
  entry: Entry,
  reverse: boolean,
  origin: string
) {
  const writes =
    entry.kind === "cells"
      ? entry.cells.map((cell) => {
          const start = Y.createAbsolutePositionFromRelativePosition(
            cell.anchor.start,
            binding.doc
          )
          const end = Y.createAbsolutePositionFromRelativePosition(
            cell.anchor.end,
            binding.doc
          )
          const content = resolveFormattingTarget(
            binding,
            cell.anchor.target
          ).content
          if (
            !start ||
            !end ||
            !(start.type instanceof Y.XmlText) ||
            end.type !== start.type ||
            end.index - start.index !== cell.anchor.content.length ||
            !textSpans(content).some((span) => span.text === start.type)
          )
            throw new Error("Changed text anchor")
          const values = reverse ? cell.before : cell.after
          const styles = engineStyles(
            inlineSchema.parse(
              Object.fromEntries(
                cell.keys.flatMap((key) =>
                  Reflect.get(values, key) === undefined
                    ? []
                    : [[key, Reflect.get(values, key)]]
                )
              )
            )
          )
          const attrs = Object.fromEntries(
            cell.keys.map((key) => {
              const value = Reflect.get(styles, key)
              return [key, value === undefined ? null : { stringValue: value }]
            })
          )
          return {
            text: start.type,
            from: start.index,
            length: cell.anchor.content.length,
            attrs,
          }
        })
      : []
  const paragraph =
    entry.kind === "property" && entry.property.scope === "paragraph"
      ? {
          node: resolveFormattingTarget(binding, entry.property.target).content,
          props: engineProps(
            contentOf(candidate, entry.property.target).paragraph
          ),
        }
      : undefined
  binding.doc.transact(() => {
    for (const write of writes)
      write.text.format(write.from, write.length, write.attrs)
    if (paragraph)
      for (const key of Object.keys(formattingProps)) {
        const value = Reflect.get(paragraph.props, key)
        const before = paragraph.node.getAttribute(key)
        if (value === undefined) {
          if (before !== undefined) paragraph.node.removeAttribute(key)
        } else if (canonical(before) !== canonical(value))
          paragraph.node.setAttribute(key, value)
      }
    if (entry.kind === "property" && entry.property.scope !== "paragraph")
      writePresentationMeta(binding.doc, candidate.presentation)
  }, origin)
}
function commit(
  binding: EngineBinding,
  candidate: PrivateFormattedDocument,
  entry: Entry,
  reverse: boolean,
  origin: string
) {
  admittedNode(candidate)
  const shadow = openFormattedBinary(
    Y.encodeStateAsUpdate(binding.doc),
    binding.kind
  )
  try {
    writeEntry(shadow, candidate, entry, reverse, origin)
    if (canonical(readFormatting(shadow)) !== canonical(candidate))
      throw new Error("Patch changes formatting semantics")
  } finally {
    shadow.doc.destroy()
  }
  writeEntry(binding, candidate, entry, reverse, origin)
}
export function prepareFormatting(
  binding: EngineBinding,
  input: unknown
): Result<PreparedFormatting> {
  return attempt(() => {
    const change = formatChangeSchema.parse(input)
    const before = readFormatting(binding)
    const entry = makeEntry(binding, before, change)
    admittedNode(project(binding, before, entry, false))
    const handle: PreparedFormatting = Object.freeze({
      kind: "prepared-formatting",
    })
    prepared.set(handle, { binding, entry, used: false })
    return handle
  })
}
export function applyFormatting(
  binding: EngineBinding,
  handle: PreparedFormatting
): Result<FormattingReceipt> {
  return attempt(() => {
    const record = prepared.get(handle)
    if (!record || record.binding !== binding || record.used)
      throw new Error("Foreign or consumed preparation")
    const candidate = project(
      binding,
      readFormatting(binding),
      record.entry,
      false
    )
    commit(binding, candidate, record.entry, false, "private-formatting-patch")
    record.used = true
    const receipt: FormattingReceipt = Object.freeze({
      kind: "formatting-receipt",
    })
    receipts.set(receipt, { ...record, used: false })
    return receipt
  })
}
export function reverseFormatting(
  binding: EngineBinding,
  handle: FormattingReceipt
): Result<void> {
  return attempt(() => {
    const record = receipts.get(handle)
    if (!record || record.binding !== binding || record.used)
      throw new Error("Foreign or consumed receipt")
    const candidate = project(
      binding,
      readFormatting(binding),
      record.entry,
      true
    )
    commit(binding, candidate, record.entry, true, "private-formatting-reverse")
    record.used = true
  })
}
