import {
  paragraphInlineValues,
  effectiveParagraphStyle,
  formattedDocumentSchema,
  layoutDocumentSchema,
  flowDocumentSchema,
  type FlowDocument,
  type FlowSection,
  type LayoutDocument,
  type LayoutPhoto,
  type LayoutTable,
  ok,
  refuse,
  type FormatBody,
  type FormatField,
  type FormatOwner,
  type FormatRun,
  type Result,
} from "@workspace/domain/internal/paper-presentation"

import {
  inlineProperties,
  pageProperties,
  paragraphProperties,
} from "./formatted-properties.js"
import { formattedStyles } from "./formatted-styles.js"
import { numberingXml, type ListSequence } from "./numbering.js"
import { wordPackage } from "./package.js"
import { photoWriter, type PhotoMedia } from "./formatted-photos.js"
import {
  assertCanonicalInput,
  wordRun,
  type ExternalLink,
} from "./rich-text.js"

type FormattedDocument = ReturnType<typeof formattedDocumentSchema.parse>

export function compileFormattedNativeDocx(input: {
  document: unknown
}): Result<Uint8Array> {
  try {
    assertCanonicalInput(input.document)
    const document = formattedDocumentSchema.parse(input.document)
    return ok(compileDocument(document))
  } catch (error) {
    return refuse(
      error instanceof Error ? error.message : "Formatted Word output refused"
    )
  }
}

export function compileLayoutNativeDocx(input: {
  document: unknown
  photos?: readonly PhotoMedia[]
}): Result<Uint8Array> {
  try {
    assertCanonicalInput(input.document)
    return ok(
      compileDocument(layoutDocumentSchema.parse(input.document), input.photos)
    )
  } catch (error) {
    return refuse(
      error instanceof Error ? error.message : "Layout Word output refused"
    )
  }
}
function compileDocument(
  document: FormattedDocument | LayoutDocument | FlowDocument,
  photos: readonly PhotoMedia[] = []
): Uint8Array {
  const styles = formattedStyles(document.presentation)
  const sequences: ListSequence[] = []
  const links: ExternalLink[] = []
  const pictures = photoWriter(photos)
  const contentWidth =
    document.presentation.page.width -
    document.presentation.page.start -
    document.presentation.page.end
  function runs(
    content: readonly FormatRun[],
    paragraphStyle?: string
  ): string {
    return content
      .map(({ text, href, ...direct }) => {
        const inherited = paragraphInlineValues(paragraphStyle)
        const effective = styles.effectiveInline({
          ...inherited,
          ...direct,
        })
        return wordRun(
          text,
          inlineProperties({
            ...direct,
            bold:
              effective.bold === inherited.bold ? undefined : effective.bold,
            italic:
              effective.italic === inherited.italic
                ? undefined
                : effective.italic,
            strike:
              effective.strike === inherited.strike
                ? undefined
                : effective.strike,
          }),
          href,
          links
        )
      })
      .join("")
  }
  function siblings(
    nodes: readonly (
      | FormatBody
      | FormatField
      | FormatOwner
      | LayoutTable
      | LayoutPhoto
      | { type: "pageBreak"; id: string }
    )[],
    depth: number,
    availableWidth = contentWidth
  ): string {
    let sequence: ListSequence | undefined
    return nodes
      .map((node) => {
        const list = node.type === "bullet" || node.type === "numbered"
        if (!list) sequence = undefined
        if (node.type === "pageBreak")
          return '<w:p><w:r><w:br w:type="page"/></w:r></w:p>'
        if (node.type === "photo") return pictures.render(node, availableWidth)
        if (node.type === "table") {
          const width = node.columns.reduce(
            (sum, column) => sum + column.width,
            0
          )
          const grid = node.columns
            .map((column) => `<w:gridCol w:w="${column.width}"/>`)
            .join("")
          const borders = [
            "top",
            "left",
            "bottom",
            "right",
            "insideH",
            "insideV",
          ]
            .map(
              (edge) => `<w:${edge} w:val="single" w:sz="6" w:color="B5B5B5"/>`
            )
            .join("")
          const margins = ["top", "left", "bottom", "right"]
            .map((edge) => `<w:${edge} w:w="120" w:type="dxa"/>`)
            .join("")
          const rows = node.children
            .map(
              (row) =>
                `<w:tr>${row.children.map((cell, index) => `<w:tc><w:tcPr><w:tcW w:w="${node.columns[index]?.width}" w:type="dxa"/></w:tcPr>${siblings(cell.children, 0, (node.columns[index]?.width ?? 0) - 240)}</w:tc>`).join("")}</w:tr>`
            )
            .join("")
          return `<w:tbl><w:tblPr><w:tblW w:w="${width}" w:type="dxa"/><w:tblBorders>${borders}</w:tblBorders><w:tblLayout w:type="fixed"/><w:tblCellMar>${margins}</w:tblCellMar></w:tblPr><w:tblGrid>${grid}</w:tblGrid>${rows}</w:tbl>`
        }
        if (!("content" in node)) {
          if (node.type === "divider")
            return '<w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="4" w:space="1" w:color="B5B5B5"/></w:pBdr></w:pPr></w:p>'
          if (node.type === "header" && node.photo !== undefined) {
            if (document.profile !== "private-layout-3")
              throw new Error(
                "Formatted Word output requires resolved photo media"
              )
            const size = Math.min(1800, Math.floor(availableWidth / 3))
            const gap = Math.min(240, Math.floor(availableWidth / 12))
            const portrait = pictures.render(
              {
                id: node.id,
                type: "photo",
                source: node.photo,
                width: size,
                height: size,
                crop: { top: 0, right: 0, bottom: 0, left: 0 },
                rotation: 0,
                shape: "rectangle",
                placement: { kind: "block", alignment: "right" },
                spacing: { top: 0, right: 0, bottom: 0, left: 0 },
                alt: "CV portrait",
              },
              size
            )
            const textWidth = Math.floor(availableWidth) - size - gap
            const cell = (width: number, content: string) =>
              `<w:tc><w:tcPr><w:tcW w:w="${width}" w:type="dxa"/><w:vAlign w:val="top"/></w:tcPr>${content}</w:tc>`
            const borders = [
              "top",
              "left",
              "bottom",
              "right",
              "insideH",
              "insideV",
            ]
              .map((edge) => `<w:${edge} w:val="nil"/>`)
              .join("")
            return `<w:tbl><w:tblPr><w:tblW w:w="${Math.floor(availableWidth)}" w:type="dxa"/><w:tblLayout w:type="fixed"/><w:tblBorders>${borders}</w:tblBorders><w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:left w:w="0" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/><w:right w:w="0" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid><w:gridCol w:w="${textWidth}"/><w:gridCol w:w="${gap}"/><w:gridCol w:w="${size}"/></w:tblGrid><w:tr>${cell(textWidth, siblings(node.children, 0, textWidth))}${cell(gap, "<w:p/>")}${cell(size, portrait)}</w:tr></w:tbl><w:p><w:pPr><w:spacing w:before="0" w:after="0"/></w:pPr></w:p>`
          }
          if ("photo" in node && node.photo !== undefined)
            throw new Error(
              "Formatted Word output requires resolved photo media"
            )
          return siblings(node.children, 0, availableWidth)
        }
        let structure = ""
        if (list) {
          if (!sequence || sequence.kind !== node.type) {
            sequence = { id: sequences.length + 1, kind: node.type, depth }
            sequences.push(sequence)
          }
          structure = `<w:numPr><w:ilvl w:val="${depth}"/><w:numId w:val="${sequence.id}"/></w:numPr>`
        }
        const paragraphStyle = effectiveParagraphStyle(
          node.type,
          node.paragraph.paragraphStyle,
          node.type === "heading" ? node.level : undefined
        )
        const effective = styles.effectiveParagraph(
          { ...node.paragraph, paragraphStyle },
          list ? (depth + 1) * 720 : undefined
        )
        const properties = paragraphProperties(
          {
            ...node.paragraph,
            paragraphStyle,
            start: effective.start,
            end: effective.end,
            indent: effective.indent,
          },
          structure
        )
        const heading =
          node.type === "heading"
            ? `<w:outlineLvl w:val="${node.level - 1}"/>`
            : ""
        const paragraph = `<w:p><w:pPr>${properties}${heading}</w:pPr>${runs(node.content, paragraphStyle)}</w:p>`
        return (
          paragraph +
          (list ? siblings(node.children, depth + 1, availableWidth) : "")
        )
      })
      .join("")
  }
  const body =
    document.profile === "private-layout-3"
      ? document.flow.children
          .map((section, index) => {
            const width =
              (section.page.width -
                section.page.start -
                section.page.end -
                (section.columns.count - 1) * section.columns.gap) /
              section.columns.count
            const body = siblings(section.children, 0, width)
            const properties = flowSectionProperties(section)
            return index === document.flow.children.length - 1
              ? body + properties
              : attachSection(body, properties)
          })
          .join("")
      : "flow" in document
        ? siblings(document.flow.children, 0)
        : document.kind === "cv"
          ? siblings([document.header, ...document.blocks], 0)
          : siblings(document.blocks, 0)
  return wordPackage({
    body:
      body +
      (document.profile === "private-layout-3"
        ? ""
        : pageProperties(document.presentation.page)),
    styles: styles.output,
    numbering: numberingXml(sequences, {
      listStep: 720,
      hanging: 360,
      paragraphIndent: false,
    }),
    links,
    media: pictures.media,
    identity: [
      ["PaperProfile", document.profile],
      ["PaperKind", document.kind],
      ["PaperExporter", "formatted-native-word-1"],
    ],
  })
}

export function compileFlowNativeDocx(input: {
  document: unknown
  photos?: readonly PhotoMedia[]
}): Result<Uint8Array> {
  try {
    assertCanonicalInput(input.document)
    return ok(
      compileDocument(flowDocumentSchema.parse(input.document), input.photos)
    )
  } catch (error) {
    return refuse(
      error instanceof Error
        ? error.message
        : "Section flow Word output refused"
    )
  }
}
function flowSectionProperties(section: FlowSection) {
  return pageProperties(section.page)
    .replace(
      "<w:sectPr>",
      `<w:sectPr><w:type w:val="${section.start === "continuous" ? "continuous" : "nextPage"}"/>`
    )
    .replace(
      "</w:sectPr>",
      `<w:cols w:num="${section.columns.count}" w:space="${section.columns.gap}" w:equalWidth="1"/></w:sectPr>`
    )
}
function attachSection(body: string, properties: string) {
  if (!body.endsWith("</w:p>"))
    return `${body}<w:p><w:pPr><w:spacing w:before="0" w:after="0"/>${properties}</w:pPr></w:p>`
  const start = body.lastIndexOf("<w:p>"),
    paragraph = body.slice(start)
  const end = paragraph.indexOf("</w:pPr>")
  return (
    body.slice(0, start) +
    (end < 0
      ? paragraph.replace("<w:p>", `<w:p><w:pPr>${properties}</w:pPr>`)
      : paragraph.slice(0, end) + properties + paragraph.slice(end))
  )
}
