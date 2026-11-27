import {
  blockIdSchema,
  documentSchema,
  isSafeHref,
  type Block,
  type Document,
  type Run,
  type SafeHref,
} from "@workspace/domain/paper-doc"

import {
  decodeXml,
  descendants,
  isWord,
  wordChild,
  type XmlElement,
} from "../import/package-xml.js"
import {
  attr,
  children,
  marksOf,
  numberingOf,
  pageOf,
  paragraphFormat,
  positive,
  stylesOf,
  value,
} from "./read-format.js"
import { attribute, readParts } from "./read-parts.js"
import { drawing, officeRelationships, wordDrawing } from "./word-xml.js"
import type { WordFiles } from "./write-docx.js"

type TextAttrs = Extract<Block, { type: "text_block" }>["attrs"]
type Image = Omit<Extract<Block, { type: "image" }>["attrs"], "id" | "align">
type Item = Run | { type: "page_break" } | { type: "image"; attrs: Image }

export type ReadDocx = {
  document: Document
  dropped: readonly string[]
  files: WordFiles
}

const comments = "Comments were left out."
const footnotes = "Footnotes were left out."
const fields =
  "Word fields were converted to their displayed text where available."
const textBoxes = "Text boxes were left out."
const unsupportedImages = "Some images were left out."

const discardedWordFeatures = new Map([
  ["txbxContent", textBoxes],
  ["commentRangeStart", comments],
  ["commentRangeEnd", comments],
  ["commentReference", comments],
  ["footnoteReference", footnotes],
  ["endnoteReference", "Endnotes were left out."],
  ["fldSimple", fields],
  ["fldChar", fields],
  ["instrText", fields],
  ["headerReference", "Headers were left out."],
  ["footerReference", "Footers were left out."],
  ["ins", "Tracked changes were imported as the current text."],
  ["del", "Tracked changes were imported as the current text."],
])

function drawingImage(
  node: XmlElement,
  parts: Awaited<ReturnType<typeof readParts>>,
  dropped: Set<string>
): Image | undefined {
  const inline = node.children.find(
    (child) => child.uri === wordDrawing && child.local === "inline"
  )
  if (inline) {
    const extent = inline.children.find(
      (child) => child.uri === wordDrawing && child.local === "extent"
    )
    const widthMpt = positive(attribute(extent, "cx"), 1 / 12.7)
    const heightMpt = positive(attribute(extent, "cy"), 1 / 12.7)
    const blip = descendants(inline).find(
      (child) => child.uri === drawing && child.local === "blip"
    )
    const embed = attribute(blip, "embed", officeRelationships)
    const description = inline.children.find(
      (child) => child.uri === wordDrawing && child.local === "docPr"
    )
    if (embed && widthMpt && heightMpt) {
      const fileId = parts.image(embed)
      if (fileId)
        return {
          fileId,
          widthMpt,
          heightMpt,
          alt:
            attribute(description, "descr") ??
            attribute(description, "title") ??
            "",
        }
    }
  }
  if (!descendants(node).some((child) => isWord(child, "txbxContent")))
    dropped.add(unsupportedImages)
  return undefined
}

export async function readDocx(bytes: Uint8Array): Promise<ReadDocx> {
  const parts = await readParts(bytes)
  const { source, root } = parts.document
  const body = isWord(root, "document") && wordChild(root, "body")
  if (!body) throw new Error("The Word file has no body")

  const styles = stylesOf(parts.styles)
  const listOf = numberingOf(parts.numbering)
  const dropped = new Set<string>()
  for (const node of descendants(body)) {
    const notice = isWord(node) && discardedWordFeatures.get(node.local)
    if (notice) dropped.add(notice)
  }
  for (const { kind } of parts.links.values()) {
    if (kind === "comments") dropped.add(comments)
  }
  const page = pageOf(wordChild(body, "sectPr"), dropped)
  let blockNumber = 0
  const nextId = () => blockIdSchema.parse(`block-${blockNumber++}`)

  function hyperlink(node: XmlElement) {
    const id = attribute(node, "id", officeRelationships)
    const link = id ? parts.links.get(id) : undefined
    if (link?.kind === "hyperlink" && link.external) {
      const anchor = attr(node, "anchor")
      const href = anchor ? `${link.target}#${anchor}` : link.target
      if (isSafeHref(href)) return href
    }
    dropped.add("Some links were left as plain text.")
    return undefined
  }

  function paragraphItems(paragraph: XmlElement, readImages: boolean) {
    const items: Item[] = []
    function visit(node: XmlElement, href?: SafeHref) {
      if (isWord(node, "r")) {
        const marks = marksOf(node, styles, href, dropped)
        let text = ""
        function flush() {
          if (text)
            items.push({ type: "text", text, ...(marks.length && { marks }) })
          text = ""
        }
        for (const part of node.children) {
          if (isWord(part, "t"))
            text += decodeXml(source.slice(part.openEnd, part.closeStart))
          else if (isWord(part, "tab")) text += "\t"
          else if (isWord(part, "noBreakHyphen")) text += "\u2011"
          else if (isWord(part, "br") || isWord(part, "cr")) {
            flush()
            items.push(
              attr(part, "type") === "page"
                ? { type: "page_break" }
                : { type: "hard_break" }
            )
          } else if (isWord(part, "drawing") && readImages) {
            const attrs = drawingImage(part, parts, dropped)
            if (attrs) {
              flush()
              items.push({ type: "image", attrs })
            }
          } else if (isWord(part, "drawing") || isWord(part, "pict")) {
            if (
              !descendants(part).some((child) => isWord(child, "txbxContent"))
            )
              dropped.add(unsupportedImages)
          }
        }
        flush()
      } else if (isWord(node, "hyperlink")) {
        const link = hyperlink(node)
        for (const child of node.children) visit(child, link)
      } else if (
        [
          "fldSimple",
          "ins",
          "moveTo",
          "smartTag",
          "customXml",
          "sdt",
          "sdtContent",
        ].some((name) => isWord(node, name))
      ) {
        for (const child of node.children) visit(child, href)
      }
    }
    for (const node of paragraph.children) visit(node)
    return items
  }

  function paragraphBlocks(paragraph: XmlElement): Block[] {
    const { numbering, rightTabMpt, ...format } = paragraphFormat(
      paragraph,
      styles
    )
    const attrs: Omit<TextAttrs, "id"> = {
      ...format,
      ...listOf(numbering, dropped),
      ...(rightTabMpt !== undefined && { rightTabMpt }),
    }
    const props = wordChild(paragraph, "pPr")
    const borders = props && wordChild(props, "pBdr")
    const items = paragraphItems(paragraph, true)
    const beforePage = value(props, "pageBreakBefore")
    const blocks: Block[] = []
    if (
      props &&
      wordChild(props, "pageBreakBefore") &&
      !["0", "false", "off"].includes(beforePage ?? "")
    )
      blocks.push({ type: "page_break", attrs: { id: nextId() } })

    let runs: Run[] = []
    function flush() {
      if (runs.length)
        blocks.push({
          type: "text_block",
          attrs: { id: nextId(), ...attrs },
          content: runs,
        })
      runs = []
    }
    for (const item of items) {
      if (item.type === "text" || item.type === "hard_break") runs.push(item)
      else {
        flush()
        const id = nextId()
        blocks.push(
          item.type === "image"
            ? {
                type: "image",
                attrs: { id, ...item.attrs, align: attrs.align },
              }
            : { type: "page_break", attrs: { id } }
        )
      }
    }
    flush()
    if (!items.length) {
      const bottom = value(borders, "bottom")
      blocks.push(
        bottom && bottom !== "none" && bottom !== "nil"
          ? { type: "divider", attrs: { id: nextId() } }
          : { type: "text_block", attrs: { id: nextId(), ...attrs } }
      )
    }
    return blocks
  }

  function tableBlocks(table: XmlElement): Block[] {
    const rows = children(table, "tr").map((row) => children(row, "tc"))
    const width = rows[0]?.length
    const merged = rows.some(
      (row) =>
        row.length !== width ||
        row.some((cell) => {
          const props = wordChild(cell, "tcPr")
          return (
            props &&
            (wordChild(props, "vMerge") ||
              wordChild(props, "hMerge") ||
              (positive(value(props, "gridSpan")) ?? 1) > 1)
          )
        })
    )
    if (!width || merged) {
      dropped.add(
        "Tables with uneven or merged cells were converted to paragraphs."
      )
      return rows.flatMap((row) => row.flatMap((cell) => blockList(cell)))
    }

    const grid = children(wordChild(table, "tblGrid"), "gridCol")
    const pageWidth =
      page.orientation === "landscape"
        ? page.size === "Letter"
          ? 792000
          : 841900
        : page.size === "Letter"
          ? 612000
          : 595300
    const available = Math.max(
      width,
      pageWidth - page.marginsMpt.left - page.marginsMpt.right
    )
    const columnsMpt = Array.from(
      { length: width },
      (_, index) =>
        positive(attr(grid[index], "w"), 50) ??
        Math.max(1, Math.round(available / width / 50)) * 50
    )
    const props = wordChild(table, "tblPr")
    const border = props && wordChild(props, "tblBorders")
    const borders = border?.children.some(
      (node) =>
        isWord(node) && !["nil", "none"].includes(attr(node, "val") ?? "nil")
    )
      ? "all"
      : "none"
    return [
      {
        type: "table",
        attrs: { id: nextId(), columnsMpt, borders },
        content: rows.map((row) => ({
          type: "table_row",
          content: row.map((cell) => {
            const content: Run[] = []
            if (children(cell, "tbl").length)
              dropped.add("Nested tables were converted to text.")
            const paragraphs = descendants(cell)
              .filter((node) => isWord(node, "p"))
              .filter((node) => {
                for (
                  let parent = node.parent;
                  parent && parent !== cell;
                  parent = parent.parent
                )
                  if (isWord(parent, "txbxContent") || isWord(parent, "del"))
                    return false
                return true
              })
            for (const [index, paragraph] of paragraphs.entries()) {
              if (index) content.push({ type: "hard_break" })
              for (const item of paragraphItems(paragraph, false)) {
                if (item.type === "page_break") {
                  dropped.add(
                    "Page breaks in table cells were changed to line breaks."
                  )
                  content.push({ type: "hard_break" })
                } else if (item.type !== "image") content.push(item)
              }
            }
            return { type: "table_cell", ...(content.length && { content }) }
          }),
        })),
      },
    ]
  }

  function blockList(parent: XmlElement): Block[] {
    return parent.children.flatMap((node) => {
      if (isWord(node, "p")) return paragraphBlocks(node)
      if (isWord(node, "tbl")) return tableBlocks(node)
      if (
        ["sdt", "sdtContent", "customXml", "ins", "moveTo"].some((name) =>
          isWord(node, name)
        )
      )
        return blockList(node)
      return []
    })
  }

  const content = blockList(body)
  if (!content.length)
    content.push({
      type: "text_block",
      attrs: {
        id: nextId(),
        kind: "paragraph",
        list: null,
        level: 0,
        align: "left",
        lineSpacing: null,
        keepWithNext: null,
      },
    })
  return {
    document: documentSchema.parse({
      type: "doc",
      attrs: { schema: 1, page, template: "classic" },
      content,
    }),
    dropped: [...dropped],
    files: parts.files,
  }
}
