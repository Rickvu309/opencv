import {
  formattedDocumentSchema,
  layoutDocumentSchema,
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
  document: FormattedDocument | LayoutDocument,
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
  function runs(content: readonly FormatRun[]): string {
    return content
      .map(({ text, href, ...direct }) => {
        const effective = styles.effectiveInline(direct)
        return wordRun(
          text,
          inlineProperties({
            ...direct,
            bold: effective.bold,
            italic: effective.italic,
            strike: effective.strike,
          }),
          href,
          links
        )
      })
      .join("")
  }
  function siblings(
    nodes: readonly (
      FormatBody | FormatField | FormatOwner | LayoutTable | LayoutPhoto
    )[],
    depth: number,
    availableWidth = contentWidth
  ): string {
    let sequence: ListSequence | undefined
    return nodes
      .map((node) => {
        const list = node.type === "bullet" || node.type === "numbered"
        if (!list) sequence = undefined
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
          if (node.photo !== undefined)
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
        const effective = styles.effectiveParagraph(
          node.paragraph,
          list ? (depth + 1) * 720 : undefined
        )
        const properties = paragraphProperties(
          {
            ...node.paragraph,
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
        const paragraph = `<w:p><w:pPr>${properties}${heading}</w:pPr>${runs(node.content)}</w:p>`
        return (
          paragraph +
          (list ? siblings(node.children, depth + 1, availableWidth) : "")
        )
      })
      .join("")
  }
  const body =
    "flow" in document
      ? siblings(document.flow.children, 0)
      : document.kind === "cv"
        ? siblings([document.header, ...document.blocks], 0)
        : siblings(document.blocks, 0)
  return wordPackage({
    body: body + pageProperties(document.presentation.page),
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
