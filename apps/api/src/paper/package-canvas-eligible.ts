import { randomUUID } from "node:crypto"
import { createRequire } from "node:module"

import {
  decodeXml,
  descendants,
  isWord,
  parsePackageXml,
  XML_NS,
  xmlText,
  type XmlElement,
} from "./package-xml.js"

const loaded = createRequire(import.meta.url)(
  "../../../../scripts/lib/paper-canvas-bytes.mjs"
) as {
  mainXml: (bytes: Uint8Array) => string
  repack: (bytes: Uint8Array, xml: string) => Uint8Array
}

const PROP_LEAVES = new Set(
  "pStyle jc spacing ind keepNext keepLines widowControl outlineLvl".split(" ")
)
const RUN_LEAVES = new Set(
  "rFonts b bCs i iCs color sz szCs u highlight vertAlign spacing lang shd".split(
    " "
  )
)

type Row = { key: string; ordinal: number; textIds: string[] }

type Side = { version: 2; paragraphs: Row[] }

type Edit =
  | { op: "split"; paragraph: string; at: number }
  | { op: "mergePrevious" | "deleteParagraph"; paragraph: string }

export type EligibleResult = {
  status: "APPLIED" | "REFUSED"
  bytes: Uint8Array
  sidecar: Side
}

function refused(bytes: Uint8Array, side: Side): EligibleResult {
  return { status: "REFUSED", bytes: Buffer.from(bytes), sidecar: side }
}

function wordKids(node: XmlElement) {
  return node.children.filter((child) => isWord(child))
}

function leaf(node: XmlElement, allowed: Set<string>) {
  return allowed.has(node.local) && !node.opaque && node.children.length === 0
}

function plainMark(node: XmlElement) {
  const kids = wordKids(node)
  return (
    kids.length === node.children.length &&
    kids.every((child) => leaf(child, RUN_LEAVES))
  )
}

function plainProps(node: XmlElement) {
  if (node.opaque || node.attributes.length > 0) return false
  const kids = wordKids(node)
  if (kids.length !== node.children.length) return false
  const marks = kids.filter((child) => child.local === "rPr")
  if (marks.length > 1) return false
  const rest = kids.filter((child) => child.local !== "rPr")
  return (
    rest.every((child) => leaf(child, PROP_LEAVES)) &&
    (!marks[0] || plainMark(marks[0]))
  )
}

function plainText(node: XmlElement) {
  return (
    !node.opaque &&
    node.children.length === 0 &&
    node.attributes.every(
      (attribute) =>
        attribute.uri === XML_NS &&
        attribute.local === "space" &&
        attribute.value === "preserve"
    )
  )
}

function textOf(source: string, node: XmlElement) {
  return node.empty
    ? ""
    : decodeXml(source.slice(node.openEnd, node.closeStart))
}

function ordinary(source: string, paragraph: XmlElement) {
  if (
    paragraph.opaque ||
    !paragraph.parent ||
    !isWord(paragraph.parent, "body")
  )
    return null
  const elements = wordKids(paragraph)
  if (elements.length !== paragraph.children.length) return null
  const runs = elements.filter((child) => child.local === "r")
  const props = elements.filter((child) => child.local === "pPr")
  if (runs.length !== 1 || props.length > 1) return null
  if (elements.length !== runs.length + props.length) return null
  if (props[0] && !plainProps(props[0])) return null
  const run = runs[0]
  if (!run) return null
  const inside = wordKids(run)
  if (inside.length !== run.children.length) return null
  const texts = inside.filter((child) => child.local === "t")
  const marks = inside.filter((child) => child.local === "rPr")
  if (texts.length !== 1 || marks.length > 1) return null
  if (inside.length !== texts.length + marks.length) return null
  if (marks[0] && !plainMark(marks[0])) return null
  const textNode = texts[0]
  if (!textNode || !plainText(textNode)) return null
  const text = textOf(source, textNode)
  if (/[\r\n]/.test(text)) return null
  return { run, textNode, text }
}

function rows(next: { key: string; textIds: string[] }[]) {
  return next.map((row, ordinal) => ({
    key: row.key,
    ordinal,
    textIds: [...row.textIds],
  }))
}

function paint(source: string, node: XmlElement, text: string) {
  const inner = xmlText(text)
  const open = source.slice(node.start, node.openEnd)
  const spaced =
    (text.startsWith(" ") || text.endsWith(" ")) && !open.includes("xml:space")
      ? open.replace(/>$/, ' xml:space="preserve">')
      : open
  return (
    source.slice(0, node.start) + spaced + inner + source.slice(node.closeStart)
  )
}

function paragraphXml(source: string, paragraph: XmlElement, text: string) {
  const found = ordinary(source, paragraph)
  if (!found) return null
  const local = source.slice(paragraph.start, paragraph.end)
  const origin = paragraph.start
  const painted = paint(
    local,
    {
      ...found.textNode,
      start: found.textNode.start - origin,
      openEnd: found.textNode.openEnd - origin,
      closeStart: found.textNode.closeStart - origin,
      end: found.textNode.end - origin,
    },
    text
  )
  return painted
}

function copyProps(source: string, paragraph: XmlElement, name: string) {
  const node = wordKids(paragraph).find((child) => child.local === name)
  const run = wordKids(paragraph).find((child) => child.local === "r")
  const mark =
    name === "rPr" && run
      ? wordKids(run).find((child) => child.local === "rPr")
      : node
  return mark ? source.slice(mark.start, mark.end) : ""
}

function freshParagraph(source: string, paragraph: XmlElement, text: string) {
  const props = copyProps(source, paragraph, "pPr")
  const mark = copyProps(source, paragraph, "rPr")
  const space =
    text.startsWith(" ") || text.endsWith(" ") ? ' xml:space="preserve"' : ""
  return `<w:p>${props}<w:r>${mark}<w:t${space}>${xmlText(text)}</w:t></w:r></w:p>`
}

function gap(source: string, left: XmlElement, right: XmlElement) {
  return source.slice(left.end, right.start).trim() === ""
}

export function applyEligibleBytes(
  bytes: Uint8Array,
  edit: Edit,
  side: Side
): EligibleResult {
  try {
    const xml = loaded.mainXml(bytes)
    const parsed = parsePackageXml(Buffer.from(xml))
    const paragraphs = descendants(parsed.root).filter((node) =>
      isWord(node, "p")
    )
    if (paragraphs.length !== side.paragraphs.length)
      return refused(bytes, side)
    const index = side.paragraphs.findIndex((row) => row.key === edit.paragraph)
    const current = side.paragraphs[index]
    const target = paragraphs[index]
    if (!current || !target) return refused(bytes, side)
    const found = ordinary(parsed.source, target)
    if (!found) return refused(bytes, side)
    if (edit.op === "split") {
      const parts = [...found.text]
      if (!Number.isInteger(edit.at) || edit.at < 0 || edit.at > parts.length)
        return refused(bytes, side)
      const left = parts.slice(0, edit.at).join("")
      const right = parts.slice(edit.at).join("")
      const leftXml =
        left === found.text
          ? parsed.source.slice(target.start, target.end)
          : paragraphXml(parsed.source, target, left)
      if (!leftXml) return refused(bytes, side)
      const next =
        parsed.source.slice(0, target.start) +
        leftXml +
        freshParagraph(parsed.source, target, right) +
        parsed.source.slice(target.end)
      const made = [
        ...side.paragraphs.slice(0, index).map((row) => ({
          key: row.key,
          textIds: [...row.textIds],
        })),
        { key: randomUUID(), textIds: [...current.textIds] },
        { key: randomUUID(), textIds: [] },
        ...side.paragraphs.slice(index + 1).map((row) => ({
          key: row.key,
          textIds: [...row.textIds],
        })),
      ]
      return {
        status: "APPLIED",
        bytes: loaded.repack(bytes, next),
        sidecar: { version: 2, paragraphs: rows(made) },
      }
    }
    if (edit.op === "deleteParagraph") {
      if (found.text !== "") return refused(bytes, side)
      const next =
        parsed.source.slice(0, target.start) + parsed.source.slice(target.end)
      const made = side.paragraphs
        .filter((_, at) => at !== index)
        .map((row) => ({ key: row.key, textIds: [...row.textIds] }))
      return {
        status: "APPLIED",
        bytes: loaded.repack(bytes, next),
        sidecar: { version: 2, paragraphs: rows(made) },
      }
    }
    const previous = paragraphs[index - 1]
    const prior = side.paragraphs[index - 1]
    const before = previous ? ordinary(parsed.source, previous) : null
    if (!previous || !prior || !before || found.text === "")
      return refused(bytes, side)
    if (!gap(parsed.source, previous, target)) return refused(bytes, side)
    const kept = paragraphXml(parsed.source, previous, before.text + found.text)
    if (!kept) return refused(bytes, side)
    const next =
      parsed.source.slice(0, previous.start) +
      kept +
      parsed.source.slice(target.end)
    const made = side.paragraphs
      .filter((_, at) => at !== index)
      .map((row, at) =>
        at === index - 1
          ? { key: randomUUID(), textIds: [...prior.textIds] }
          : { key: row.key, textIds: [...row.textIds] }
      )
    return {
      status: "APPLIED",
      bytes: loaded.repack(bytes, next),
      sidecar: { version: 2, paragraphs: rows(made) },
    }
  } catch {
    return refused(bytes, side)
  }
}
