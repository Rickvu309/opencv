import {
  resolveStyles,
  resolveInline,
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
  overrides: InlinePresentation
): InlinePresentation {
  const styles = value(resolveStyles(document.styles))
  const { characterStyle: defaultStyle, ...defaults } = document.inline
  const { characterStyle, ...direct } = overrides
  return {
    ...value(resolveInline(styles, defaultStyle ?? null, defaults)),
    ...value(resolveInline(styles, characterStyle ?? null, direct)),
  }
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

function fontCss(fontId: NonNullable<InlinePresentation["fontId"]>): string {
  switch (fontId) {
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
    `color:${v.color ?? "inherit"}`,
    `background-color:${v.highlight ?? "transparent"}`,
    ...(v.fontId ? [`font-family:${fontCss(v.fontId)}`] : []),
    ...(v.size === undefined ? [] : [`font-size:${v.size / 20}pt`]),
  ].join(";")
}

export function paragraphCss(v: ParagraphPresentation): string {
  const line = v.lineSpacing
  const indent = v.indent
  return [
    `text-align:${v.alignment ?? "left"}`,
    `margin-block-start:${(v.before ?? 0) / 20}pt`,
    `margin-block-end:${(v.after ?? 0) / 20}pt`,
    `padding-inline-start:${(v.start ?? 0) / 20}pt`,
    `padding-inline-end:${(v.end ?? 0) / 20}pt`,
    ...(line
      ? [
          `line-height:${line.kind === "multiple" ? line.value : `${line.value / 20}pt`}`,
        ]
      : []),
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
