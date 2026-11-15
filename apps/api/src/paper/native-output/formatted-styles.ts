import {
  inlineSchema,
  paragraphSchema,
  resolveStyles,
  resolveInline,
  resolveParagraph,
  type DocumentPresentation,
  type InlinePresentation,
  type ParagraphPresentation,
  type Result,
} from "@workspace/domain/internal/paper-presentation"

import {
  inlineProperties,
  paragraphProperties,
} from "./formatted-properties.js"
import { xml } from "./rich-text.js"

function value<T>(result: Result<T>): T {
  if (result.kind === "refused") throw new Error(result.reason)
  return result.value
}

export function formattedStyles(document: DocumentPresentation) {
  const styles = value(resolveStyles(document.styles))
  const { characterStyle, ...inline } = document.inline
  const { paragraphStyle, ...paragraph } = document.paragraph
  const documentParagraph = value(
    resolveParagraph(styles, paragraphStyle ?? null, paragraph)
  )
  const defaults = {
    inline: inlineSchema.parse({
      fontId: "liberation-sans",
      size: 220,
      bold: false,
      italic: false,
      underline: false,
      strike: false,
      color: "#000000",
      ...value(resolveInline(styles, characterStyle ?? null, inline)),
    }),
    paragraph: paragraphSchema.parse({
      alignment: "left",
      before: 0,
      after: 0,
      start: 0,
      end: 0,
      lineSpacing: { kind: "multiple", value: 1.2 },
      keepNext: false,
      keepTogether: false,
      widowOrphan: true,
      ...documentParagraph,
    }),
  }
  function effectiveParagraph(
    overrides: ParagraphPresentation,
    listStart?: number
  ) {
    const { paragraphStyle: reference, ...direct } = overrides
    return {
      ...defaults.paragraph,
      ...(listStart === undefined
        ? {}
        : paragraphSchema.parse({
            start: listStart,
            indent: { kind: "hanging", value: 360 },
          })),
      ...documentParagraph,
      ...value(resolveParagraph(styles, reference ?? null, direct)),
    }
  }
  function effectiveInline(overrides: InlinePresentation) {
    const { characterStyle: reference, ...direct } = overrides
    return {
      ...defaults.inline,
      ...value(resolveInline(styles, reference ?? null, direct)),
    }
  }
  function withoutIndent(input: ParagraphPresentation) {
    const result = { ...input }
    delete result.indent
    return result
  }
  const named = styles
    .map((style) => {
      const properties =
        style.kind === "character"
          ? `<w:rPr>${inlineProperties(style.values)}</w:rPr>`
          : `<w:pPr>${paragraphProperties(withoutIndent(style.values))}</w:pPr>`
      return `<w:style w:type="${style.kind}" w:styleId="Paper-${xml(style.id)}"><w:name w:val="${xml(style.id)}"/>${properties}</w:style>`
    })
    .join("")
  const output = `<w:docDefaults><w:rPrDefault><w:rPr>${inlineProperties(defaults.inline)}</w:rPr></w:rPrDefault><w:pPrDefault><w:pPr>${paragraphProperties(withoutIndent(defaults.paragraph))}</w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>${named}`
  return { output, effectiveInline, effectiveParagraph }
}
