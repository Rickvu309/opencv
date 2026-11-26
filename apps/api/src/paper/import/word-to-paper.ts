import {
  emptyRichPaper,
  richPaperDocumentSchema,
  type RichPaperDocument,
} from "@workspace/domain/paper-doc"

import {
  decodeXml,
  parsePackageXml,
  wordAttribute,
  wordChild,
  isWord,
  type XmlElement,
} from "./package-xml.js"
import {
  numberingOf,
  pageOf,
  paragraphLook,
  runLook,
  stylesOf,
  levelOfOutline,
  type Page,
  type Paragraph,
  type Run,
  type Styles,
} from "./word-looks.js"
import { readPackageZip } from "./package-zip.js"
import type { TemplateLine } from "@workspace/domain/paper-doc"

type Kind = "cv" | "letter"
type Body = {
  id: string
  type: "paragraph" | "heading" | "bullet" | "numbered"
  level?: 2 | 3
  paragraph: Paragraph
  content: Run[]
  children?: Body[]
}
type Table = {
  id: string
  type: "table"
  columns: { id: string; width: number }[]
  children: {
    id: string
    type: "row"
    children: { id: string; type: "cell"; columnId: string; children: Body[] }[]
  }[]
}
type PageBreak = { id: string; type: "pageBreak" }
type Node = Body | Table | PageBreak

export type WordToPaper = {
  readonly paper: RichPaperDocument
  readonly dropped: readonly string[]
}

export const PHOTOS_DROPPED = "photos"
export const TABLES_FLATTENED = "merged table cells"

type Reading = {
  source: string
  styles: Styles
  lists: Map<string, "bullet" | "numbered">
  dropped: Set<string>
  next: (prefix: string) => string
}

function textOf(node: XmlElement, source: string) {
  return decodeXml(source.slice(node.openEnd, node.closeStart))
}

function cleanText(text: string) {
  return Array.from(text, (char) => {
    const code = char.codePointAt(0) ?? 0
    return code === 9 || code === 10 || (code >= 32 && code !== 127) ? char : ""
  }).join("")
}

function runsOf(
  paragraph: XmlElement,
  reading: Reading,
  base: Omit<Run, "text">
): { runs: Run[]; pageBreak: boolean } {
  const runs: Run[] = []
  let pageBreak = false
  const visit = (node: XmlElement) => {
    if (isWord(node, "r")) {
      const look = { ...base, ...runLook(wordChild(node, "rPr")) }
      let text = ""
      for (const part of node.children) {
        if (isWord(part, "t")) text += textOf(part, reading.source)
        else if (isWord(part, "tab")) text += "\t"
        else if (isWord(part, "br"))
          if (wordAttribute(part, "type") === "page") pageBreak = true
          else text += "\n"
        else if (isWord(part, "drawing") || isWord(part, "pict"))
          reading.dropped.add(PHOTOS_DROPPED)
      }
      const clean = cleanText(text)
      if (clean) runs.push({ ...look, text: clean })
      return
    }
    if (isWord(node, "pPr") || isWord(node, "del")) return
    for (const child of node.children) visit(child)
  }
  for (const child of paragraph.children) visit(child)
  return { runs, pageBreak }
}

function bodyOf(
  paragraph: XmlElement,
  reading: Reading
): {
  node: Body
  list?: { level: number }
  pageBreak: boolean
} {
  const props = wordChild(paragraph, "pPr")
  const styleId =
    props && wordAttribute(wordChild(props, "pStyle") ?? props, "val")
  const style =
    props && wordChild(props, "pStyle") && styleId
      ? reading.styles.get(styleId)
      : undefined
  const { runs, pageBreak } = runsOf(paragraph, reading, style?.run ?? {})
  const look = { ...style?.paragraph, ...paragraphLook(props) }
  const numbering = (props && wordChild(props, "numPr")) ?? style?.numbering
  const numId =
    numbering &&
    wordAttribute(wordChild(numbering, "numId") ?? numbering, "val")
  const listKind =
    numId && numId !== "0" ? (reading.lists.get(numId) ?? "bullet") : undefined
  if (listKind) {
    const level = Number(
      wordAttribute(wordChild(numbering!, "ilvl") ?? numbering!, "val") ?? 0
    )
    delete look.start
    delete look.indent
    return {
      node: {
        id: reading.next("item"),
        type: listKind,
        paragraph: look,
        content: runs,
        children: [],
      },
      list: { level: Number.isInteger(level) ? Math.min(level, 2) : 0 },
      pageBreak,
    }
  }
  const outline = props && wordChild(props, "outlineLvl")
  const level = outline
    ? levelOfOutline(Number(wordAttribute(outline, "val")))
    : style?.level
  if (level && runs.length)
    return {
      node: {
        id: reading.next("heading"),
        type: "heading",
        level,
        paragraph: look,
        content: runs,
      },
      pageBreak,
    }
  return {
    node: {
      id: reading.next("paragraph"),
      type: "paragraph",
      paragraph: look,
      content: runs,
    },
    pageBreak,
  }
}

function nestLists(items: { node: Body; list?: { level: number } }[]): Body[] {
  const out: Body[] = []
  const open: Body[] = []
  for (const { node, list } of items) {
    if (!list) {
      open.length = 0
      out.push(node)
      continue
    }
    open.length = Math.min(open.length, list.level)
    const parent = open[open.length - 1]
    if (parent && list.level > 0) parent.children!.push(node)
    else {
      open.length = 0
      out.push(node)
    }
    open.push(node)
  }
  return out
}

function bodiesOf(paragraphs: XmlElement[], reading: Reading): Body[] {
  return nestLists(paragraphs.map((paragraph) => bodyOf(paragraph, reading)))
}

function tableOf(table: XmlElement, reading: Reading, width: number): Node[] {
  const grid = wordChild(table, "tblGrid")
  const gridWidths = (grid?.children ?? [])
    .filter((node) => isWord(node, "gridCol"))
    .map((node) => Number(wordAttribute(node, "w")) || 0)
  const rows = table.children.filter((node) => isWord(node, "tr"))
  const cellsOf = (row: XmlElement) =>
    row.children.filter((node) => isWord(node, "tc"))
  const merged = rows.some((row) =>
    cellsOf(row).some((cell) => {
      const props = wordChild(cell, "tcPr")
      return (
        props && (wordChild(props, "gridSpan") || wordChild(props, "vMerge"))
      )
    })
  )
  const count = gridWidths.length
  const rectangular =
    count > 0 &&
    count <= 20 &&
    rows.length > 0 &&
    rows.length <= 200 &&
    rows.every((row) => cellsOf(row).length === count)
  const flatten = () =>
    rows.flatMap((row) =>
      cellsOf(row).flatMap((cell) =>
        bodiesOf(
          cell.children.filter((node) => isWord(node, "p")),
          reading
        )
      )
    )
  if (merged || !rectangular) {
    reading.dropped.add(TABLES_FLATTENED)
    return flatten()
  }
  const total = gridWidths.reduce((sum, value) => sum + value, 0) || count
  const scale = Math.min(1, width / total)
  const columns = gridWidths.map((value) => ({
    id: reading.next("column"),
    width: Math.max(480, Math.floor((value || total / count) * scale)),
  }))
  if (columns.reduce((sum, column) => sum + column.width, 0) > width) {
    reading.dropped.add(TABLES_FLATTENED)
    return flatten()
  }
  return [
    {
      id: reading.next("table"),
      type: "table",
      columns,
      children: rows.map((row) => ({
        id: reading.next("row"),
        type: "row",
        children: cellsOf(row).map((cell, index) => {
          const bodies = bodiesOf(
            cell.children.filter((node) => isWord(node, "p")),
            reading
          )
          return {
            id: reading.next("cell"),
            type: "cell",
            columnId: columns[index]!.id,
            children: bodies.length
              ? bodies
              : [
                  {
                    id: reading.next("paragraph"),
                    type: "paragraph" as const,
                    paragraph: {},
                    content: [],
                  },
                ],
          }
        }),
      })),
    },
  ]
}

function counter() {
  let count = 0
  return (prefix: string) => `${prefix}-${++count}`
}

function assemble(
  kind: Kind,
  page: Page,
  nodes: Node[],
  inline: { fontId?: string; size?: number } = {}
) {
  const blank = emptyRichPaper(kind)
  const section = blank.flow.children[0]!
  const header = kind === "cv" ? section.children.slice(0, 1) : []
  const body: unknown[] = nodes.length
    ? nodes
    : [{ id: "paragraph-1", type: "paragraph", paragraph: {}, content: [] }]
  return {
    ...blank,
    presentation: {
      ...blank.presentation,
      page,
      inline: { ...blank.presentation.inline, ...inline },
    },
    flow: {
      ...blank.flow,
      children: [{ ...section, page, children: [...header, ...body] }],
    },
  }
}

function plainCopy(nodes: Node[], next: (prefix: string) => string): Node[] {
  const text = (body: Body): Body[] => [
    {
      id: next("paragraph"),
      type: "paragraph",
      paragraph: {},
      content: body.content
        .map((run) => ({ text: run.text }))
        .filter((run) => run.text),
    },
    ...(body.children ?? []).flatMap(text),
  ]
  return nodes.flatMap((node) =>
    node.type === "pageBreak"
      ? []
      : node.type === "table"
        ? node.children.flatMap((row) =>
            row.children.flatMap((cell) => cell.children.flatMap(text))
          )
        : text(node)
  )
}

const LINE_LOOKS: Record<
  TemplateLine["style"],
  { run: Omit<Run, "text">; paragraph: Paragraph }
> = {
  Title: { run: { bold: true, size: 400 }, paragraph: { after: 60 } },
  Heading1: {
    run: { bold: true, size: 260 },
    paragraph: { keepNext: true, before: 240, after: 80 },
  },
  ListBullet: { run: {}, paragraph: {} },
  Normal: { run: {}, paragraph: {} },
}

export function paperFromLines(
  kind: Kind,
  lines: readonly TemplateLine[]
): RichPaperDocument {
  const next = counter()
  const nodes: Body[] = lines.map((line) => {
    const look = LINE_LOOKS[line.style]
    const paragraph = {
      ...look.paragraph,
      ...(line.center ? { alignment: "center" } : {}),
    }
    const text = cleanText(line.text)
    const content = text ? [{ ...look.run, text }] : []
    if (line.style === "Title" || line.style === "Heading1")
      return {
        id: next("heading"),
        type: "heading",
        level: 2,
        paragraph,
        content,
      }
    if (line.style === "ListBullet")
      return {
        id: next("item"),
        type: "bullet",
        paragraph,
        content,
        children: [],
      }
    return { id: next("paragraph"), type: "paragraph", paragraph, content }
  })
  while (nodes.at(-1)?.type === "paragraph" && !nodes.at(-1)!.content.length)
    nodes.pop()
  const blank = emptyRichPaper(kind)
  return richPaperDocumentSchema.parse(
    assemble(kind, blank.presentation.page, nodes, {
      fontId: "liberation-sans",
      size: 220,
    })
  )
}

export async function paperFromWord(
  bytes: Uint8Array,
  kind: Kind
): Promise<WordToPaper> {
  const zip = await readPackageZip(bytes)
  const xmlOf = (name: string) => {
    const member = zip.files.get(name)
    return member ? parsePackageXml(member) : null
  }
  const document = xmlOf("word/document.xml")
  if (!document) throw new Error("The Word file has no document part")
  const stylesXml = xmlOf("word/styles.xml")
  const reading: Reading = {
    source: document.source,
    styles: stylesOf(stylesXml?.root ?? null),
    lists: numberingOf(xmlOf("word/numbering.xml")?.root ?? null),
    dropped: new Set(),
    next: counter(),
  }
  const defaults = stylesXml?.root.children.find((node) =>
    isWord(node, "docDefaults")
  )
  const defaultRun =
    defaults && wordChild(wordChild(defaults, "rPrDefault") ?? defaults, "rPr")
  const initial = runLook(defaultRun)
  const inline = {
    ...(initial.fontId ? { fontId: initial.fontId } : {}),
    ...(initial.size ? { size: initial.size } : {}),
  }
  const body = wordChild(document.root, "body")
  if (!body) throw new Error("The Word file has no body")
  const blankPage = emptyRichPaper(kind).presentation.page
  const page = pageOf(wordChild(body, "sectPr"), blankPage)
  const width = page.width - page.start - page.end
  const nodes: Node[] = []
  let pending: XmlElement[] = []
  const flush = () => {
    if (!pending.length) return
    const read = pending.map((paragraph) => bodyOf(paragraph, reading))
    pending = []
    const grouped: { node: Body; list?: { level: number } }[] = []
    for (const item of read) {
      if (!item.pageBreak || item.node.content.length || item.list)
        grouped.push(item)
      if (item.pageBreak) {
        nodes.push(...nestLists(grouped.splice(0)))
        nodes.push({ id: reading.next("break"), type: "pageBreak" })
      }
    }
    nodes.push(...nestLists(grouped))
  }
  for (const node of body.children) {
    if (isWord(node, "p")) pending.push(node)
    else if (isWord(node, "tbl")) {
      flush()
      nodes.push(...tableOf(node, reading, width))
    } else if (isWord(node, "sdt")) {
      const content = wordChild(node, "sdtContent")
      pending.push(
        ...(content?.children ?? []).filter((child) => isWord(child, "p"))
      )
    }
  }
  flush()
  const blankEnd = () => {
    const last = nodes.at(-1)
    return (
      last?.type === "pageBreak" ||
      (last?.type === "paragraph" && last.content.length === 0)
    )
  }
  while (nodes.length && blankEnd()) nodes.pop()
  while (nodes[0]?.type === "pageBreak") nodes.shift()
  const shaped = richPaperDocumentSchema.safeParse(
    assemble(kind, page, nodes, inline)
  )
  if (shaped.success)
    return { paper: shaped.data, dropped: [...reading.dropped] }
  const plain = richPaperDocumentSchema.parse(
    assemble(kind, blankPage, plainCopy(nodes, counter()))
  )
  return { paper: plain, dropped: [...reading.dropped, "formatting"] }
}
