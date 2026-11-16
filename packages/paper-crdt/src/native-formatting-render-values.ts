import {
  resolveStyles,
  effectiveRunInline,
  resolveParagraph,
  type DocumentPresentation,
  type InlinePresentation,
  type ParagraphPresentation,
  type Result,
} from "@workspace/domain/internal/paper-presentation"

function value<T>(result: Result<T>): T {
  if (result.kind === "refused") throw new Error(result.reason)
  return result.value
}

export function effectiveInline(
  document: DocumentPresentation,
  overrides: InlinePresentation,
  paragraphStyle?: string
): InlinePresentation {
  return value(effectiveRunInline(document, paragraphStyle, overrides))
}

export function effectiveParagraph(
  document: DocumentPresentation,
  overrides: ParagraphPresentation
): ParagraphPresentation {
  const styles = value(resolveStyles(document.styles))
  const { paragraphStyle: defaultStyle, ...defaults } = document.paragraph
  const { paragraphStyle, ...direct } = overrides
  return {
    ...value(resolveParagraph(styles, defaultStyle ?? null, defaults)),
    ...value(resolveParagraph(styles, paragraphStyle ?? null, direct)),
  }
}

function fontCss(fontId: InlinePresentation["fontId"]): string {
  switch (fontId) {
    case undefined:
    case "liberation-sans":
      return '"Liberation Sans", Arial, sans-serif'
    case "liberation-serif":
      return '"Liberation Serif", "Times New Roman", serif'
    case "liberation-mono":
      return '"Liberation Mono", "Courier New", monospace'
    default:
      throw new Error("Unsupported Paper font")
  }
}

export function inlineCss(v: InlinePresentation): string {
  const decoration = [
    v.underline ? "underline" : "",
    v.strike ? "line-through" : "",
  ]
    .filter(Boolean)
    .join(" ")
  return [
    `font-weight:${v.bold ? "700" : "400"}`,
    `font-style:${v.italic ? "italic" : "normal"}`,
    `text-decoration-line:${decoration || "none"}`,
    `color:${v.color ?? "#000000"}`,
    `background-color:${v.highlight ?? "transparent"}`,
    `font-family:${fontCss(v.fontId)}`,
    `font-size:${(v.size ?? 220) / 20}pt`,
  ].join(";")
}

export function paragraphCss(v: ParagraphPresentation): string {
  const line = v.lineSpacing
  const indent = v.indent
  return [
    `text-align:${v.alignment ?? "left"}`,
    `margin-block-start:${(v.before ?? 0) / 20}pt`,
    `margin-block-end:${(v.after ?? 0) / 20}pt`,
    `padding-inline-start:${Math.max(v.start ?? 0, indent?.kind === "hanging" ? indent.value : 0) / 20}pt`,
    `padding-inline-end:${(v.end ?? 0) / 20}pt`,
    ...(line
      ? [
          `line-height:${line.kind === "multiple" ? line.value : `${line.value / 20}pt`}`,
        ]
      : ["line-height:1.2"]),
    ...(indent
      ? [
          `text-indent:${(indent.kind === "hanging" ? -indent.value : indent.value) / 20}pt`,
        ]
      : []),
    ...(v.keepNext ? ["break-after:avoid"] : []),
    ...(v.keepTogether ? ["break-inside:avoid"] : []),
    ...(v.widowOrphan === undefined
      ? []
      : [`orphans:${v.widowOrphan ? 2 : 1};widows:${v.widowOrphan ? 2 : 1}`]),
  ].join(";")
}
