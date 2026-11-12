import { createRequire } from "node:module"

import type { WordMark, WordParagraph } from "@workspace/domain"

import {
  marksOf,
  packageLook,
  paragraphLook,
  type WordPackageLook,
} from "./look.js"

type WordPiece = WordParagraph["pieces"][number]

type WordNode = {
  qname: string
  local: string
  start: number
  openEnd: number
  closeStart: number
  end: number
  children: WordNode[]
  parent: WordNode | undefined
}

export type WordParagraphView = { node: WordNode; xml: string; slice: string }

export type WordParagraphSlot = WordParagraphView & { nested: boolean }

const canvas = createRequire(import.meta.url)(
  "../../../../../scripts/lib/paper-canvas-bytes.mjs"
) as {
  paragraphsOf: (bytes: Uint8Array) => WordParagraphView[]
  contentOf: (paragraph: WordParagraphView) => string
  isCarrier: (paragraph: WordParagraphView) => boolean
  member: (bytes: Uint8Array, name: string) => string
}

export type WordRun = {
  xml: string
  open: string
  props: string
  text: string
  body: { lead: string; head: string; raw: string; trail: string } | null
  origin: { start: number; end: number } | null
}

export type WordKept = { xml: string; text: string }

export type WordPart =
  { run: WordRun; kept: null } | { run: null; kept: WordKept }

export type WordShape = { code: string; message: string }

export type WordLine = {
  open: string
  props: string
  parts: WordPart[]
  text: string
  shape: WordShape | null
  origin: { xml: string; start: number; open: string } | null
}

export type WordDisposition =
  | { kind: "carrier" }
  | { kind: "held"; code: string; message: string; text: string }
  | { kind: "line"; line: WordLine }

const markNames = new Set([
  "pPrChange",
  "rPrChange",
  "sectPrChange",
  "ins",
  "del",
  "moveFrom",
  "moveTo",
])

const heldMessages = {
  SECTION: "This line ends a page section. Paper will not change it.",
  NOT_BODY: "This line sits in a table or a box. Paper will not change it.",
  CHANGE_MARK: "This paragraph has a change mark. Paper will not change it.",
  HIDDEN_MARKUP:
    "This paragraph holds hidden Word markup. Paper will not change it.",
  WORD_FEATURE:
    "This paragraph has a link, a field, a tab or another Word feature. Paper will not change it.",
  NO_RUN: "This empty line has no place for words. Paper will not change it.",
  CONTROL_CHARACTER:
    "This paragraph has a break or a hidden character. Paper will not change it.",
} as const

const shapeMessages = {
  NUMBERING:
    "This paragraph is numbered. Paper can change its words but will not split, join or remove it.",
  NOT_BODY:
    "This line sits in a table. Paper can change its words but will not split, join or remove it.",
  WORD_FEATURE:
    "This paragraph has a link, a break or a proofing mark. Paper can change the words around them but will not split, join or remove it.",
} as const

export type WordHeldCode = keyof typeof heldMessages

function shaped(code: keyof typeof shapeMessages): WordShape {
  return { code, message: shapeMessages[code] }
}

function every(node: WordNode, out: WordNode[] = []) {
  for (const child of node.children) {
    out.push(child)
    every(child, out)
  }
  return out
}

function named(node: WordNode | undefined, local: string) {
  return node?.qname === `w:${local}`
}

export function paragraphsOf(bytes: Uint8Array): WordParagraphSlot[] {
  return canvas.paragraphsOf(bytes).flatMap((view) => [
    { ...view, nested: false },
    ...every(view.node)
      .filter((node) => node.local === "p")
      .map((node) => ({
        node,
        xml: view.xml,
        slice: view.xml.slice(node.start, node.end),
        nested: true,
      })),
  ])
}

export function decodeWordText(raw: string) {
  return raw.replace(
    /&(#x[0-9a-fA-F]+|#[0-9]+|lt|gt|quot|apos|amp);/g,
    (_, entity: string) => {
      if (entity.startsWith("#x"))
        return String.fromCodePoint(parseInt(entity.slice(2), 16))
      if (entity.startsWith("#"))
        return String.fromCodePoint(parseInt(entity.slice(1), 10))
      return { lt: "<", gt: ">", quot: '"', apos: "'", amp: "&" }[
        entity as "lt"
      ]
    }
  )
}

export function hasControlCharacter(text: string) {
  return [...text].some((letter) => {
    const code = letter.codePointAt(0) ?? 0
    return code < 0x20 || code === 0x7f
  })
}

function slice(view: WordParagraphView, node: WordNode) {
  return view.xml.slice(node.start, node.end)
}

function runOf(view: WordParagraphView, run: WordNode): WordRun | null {
  const [first, ...rest] = run.children
  const props = named(first, "rPr") ? first : undefined
  const texts = props ? rest : run.children
  if (texts.length === 0) return null
  if (!texts.every((node) => named(node, "t") && node.children.length === 0))
    return null
  const only =
    texts.length === 1 &&
    texts[0] &&
    view.xml.slice(texts[0].closeStart, texts[0].end).startsWith("</")
      ? texts[0]
      : undefined
  return {
    xml: slice(view, run),
    open: view.xml.slice(run.start, run.openEnd),
    props: props ? slice(view, props) : "",
    text: texts
      .map((node) =>
        decodeWordText(view.xml.slice(node.openEnd, node.closeStart))
      )
      .join(""),
    body: only
      ? {
          lead: view.xml.slice(run.start, only.start),
          head: view.xml.slice(only.start, only.openEnd),
          raw: view.xml.slice(only.openEnd, only.closeStart),
          trail: view.xml.slice(only.closeStart, run.end),
        }
      : null,
    origin: { start: run.start, end: run.end },
  }
}

function keptOf(view: WordParagraphView, node: WordNode): WordKept | null {
  const xml = slice(view, node)
  if (named(node, "proofErr") && node.children.length === 0)
    return { xml, text: "" }
  if (named(node, "hyperlink") && node.children.length > 0) {
    const runs = node.children.map((child) =>
      named(child, "r") ? runOf(view, child) : null
    )
    if (runs.every((item) => item !== null))
      return { xml, text: runs.map((item) => item?.text ?? "").join("") }
    return null
  }
  if (!named(node, "r")) return null
  const [first, ...rest] = node.children
  const inner = named(first, "rPr") ? rest : node.children
  if (
    inner.length === 1 &&
    /^<w:br\s*\/>$/.test(slice(view, inner[0] as WordNode))
  )
    return { xml, text: "\n" }
  return null
}

function simpleCell(node: WordNode) {
  const cell = node.parent
  const row = cell?.parent
  const table = row?.parent
  return (
    named(cell, "tc") &&
    named(row, "tr") &&
    named(table, "tbl") &&
    named(table?.parent, "body") &&
    (cell?.children ?? []).every(
      (child) => child === node || named(child, "tcPr")
    )
  )
}

function held(code: WordHeldCode, view: WordParagraphView): WordDisposition {
  return {
    kind: "held",
    code,
    message: heldMessages[code],
    text: canvas.contentOf(view).replace(/<!--[\s\S]*?-->|<\?[\s\S]*?\?>/g, ""),
  }
}

export function classifyParagraph(view: WordParagraphView): WordDisposition {
  if (canvas.isCarrier(view))
    return canvas.contentOf(view) === ""
      ? { kind: "carrier" }
      : held("SECTION", view)
  const node = view.node
  const cell = simpleCell(node)
  if (!named(node.parent, "body") && !cell) return held("NOT_BODY", view)
  const inside = every(node)
  if (inside.some((item) => markNames.has(item.local)))
    return held("CHANGE_MARK", view)
  if (/<!--|<\?|<!\[CDATA\[/.test(view.slice))
    return held("HIDDEN_MARKUP", view)
  const [first, ...rest] = node.children
  const props = named(first, "pPr") ? first : undefined
  const children = props ? rest : node.children
  const parts: WordPart[] = []
  for (const item of children) {
    const run = named(item, "r") ? runOf(view, item) : null
    if (run) {
      parts.push({ run, kept: null })
      continue
    }
    const kept = keptOf(view, item)
    if (!kept) return held("WORD_FEATURE", view)
    parts.push({ run: null, kept })
  }
  const runs = parts.flatMap((part) => (part.run ? [part.run] : []))
  if (parts.length === 0) return held("NO_RUN", view)
  if (runs.length === 0) return held("WORD_FEATURE", view)
  const text = runs.map((run) => run.text).join("")
  if (hasControlCharacter(text)) return held("CONTROL_CHARACTER", view)
  const open = view.xml.slice(node.start, node.openEnd)
  return {
    kind: "line",
    line: {
      open,
      props: props ? slice(view, props) : "",
      parts,
      text,
      shape: inside.some((item) => item.local === "numPr")
        ? shaped("NUMBERING")
        : cell
          ? shaped("NOT_BODY")
          : parts.some((part) => part.kept)
            ? shaped("WORD_FEATURE")
            : null,
      origin: { xml: view.slice, start: node.start, open },
    },
  }
}

function piecesOf(line: WordLine): WordPiece[] {
  const pieces: { text: string; props: string | null; marks: WordMark[] }[] = []
  for (const part of line.parts) {
    if (part.kept) {
      if (part.kept.text !== "")
        pieces.push({
          text: part.kept.text,
          props: null,
          marks: marksOf(
            part.kept.xml,
            part.kept.xml.startsWith("<w:hyperlink")
          ),
        })
      continue
    }
    const last = pieces.at(-1)
    if (last && last.props === part.run.props) last.text += part.run.text
    else
      pieces.push({
        text: part.run.text,
        props: part.run.props,
        marks: marksOf(part.run.props),
      })
  }
  return pieces.map((piece) => ({
    text: piece.text,
    editable: piece.props !== null,
    ...(piece.marks.length > 0 ? { marks: piece.marks } : {}),
  }))
}

function partOf(bytes: Uint8Array, name: string): string | null {
  try {
    return canvas.member(bytes, name)
  } catch {
    return null
  }
}

function lookOf(bytes: Uint8Array): WordPackageLook {
  return packageLook(
    partOf(bytes, "word/styles.xml"),
    partOf(bytes, "word/numbering.xml")
  )
}

export function projectParagraphs(
  bytes: Uint8Array,
  keys: readonly string[]
): WordParagraph[] | null {
  const views = paragraphsOf(bytes)
  if (views.length !== keys.length) return null
  const look = lookOf(bytes)
  return views.flatMap((view, index): WordParagraph[] => {
    const handle = keys[index] as string
    const disposition = classifyParagraph(view)
    if (disposition.kind === "carrier") return []
    if (disposition.kind === "held")
      return [
        {
          handle,
          text: disposition.text,
          pieces: [{ text: disposition.text, editable: false }],
          held: true,
          message: disposition.message,
          code: disposition.code,
        },
      ]
    return [
      {
        handle,
        text: disposition.line.text,
        pieces: piecesOf(disposition.line),
        held: false,
        message: "",
        code: null,
        ...paragraphLook(disposition.line.props, look),
      },
    ]
  })
}
