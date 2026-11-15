import {
  formattedDocumentSchema,
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
import {
  assertCanonicalInput,
  wordRun,
  type ExternalLink,
} from "./rich-text.js"

export function compileFormattedNativeDocx(input: {
  document: unknown
}): Result<Uint8Array> {
  try {
    assertCanonicalInput(input.document)
    const document = formattedDocumentSchema.parse(input.document)
    const styles = formattedStyles(document.presentation)
    const sequences: ListSequence[] = []
    const links: ExternalLink[] = []
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
      nodes: readonly (FormatBody | FormatField | FormatOwner)[],
      depth: number
    ): string {
      let sequence: ListSequence | undefined
      return nodes
        .map((node) => {
          const list = node.type === "bullet" || node.type === "numbered"
          if (!list) sequence = undefined
          if (!("content" in node)) {
            if (node.type === "divider")
              return '<w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="4" w:space="1" w:color="B5B5B5"/></w:pBdr></w:pPr></w:p>'
            if (node.photo !== undefined)
              throw new Error(
                "Formatted Word output requires resolved photo media"
              )
            return siblings(node.children, 0)
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
          return paragraph + (list ? siblings(node.children, depth + 1) : "")
        })
        .join("")
    }
    const body =
      document.kind === "cv"
        ? siblings([document.header, ...document.blocks], 0)
        : siblings(document.blocks, 0)
    return ok(
      wordPackage({
        body: body + pageProperties(document.presentation.page),
        styles: styles.output,
        numbering: numberingXml(sequences, {
          listStep: 720,
          hanging: 360,
          paragraphIndent: false,
        }),
        links,
        identity: [
          ["PaperProfile", document.profile],
          ["PaperKind", document.kind],
          ["PaperExporter", "formatted-native-word-1"],
        ],
      })
    )
  } catch (error) {
    return refuse(
      error instanceof Error ? error.message : "Formatted Word output refused"
    )
  }
}
