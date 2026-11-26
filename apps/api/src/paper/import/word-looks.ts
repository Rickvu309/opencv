import {
  isWord,
  wordAttribute,
  wordChild,
  type XmlElement,
} from "./package-xml.js"

export type Run = {
  text: string
  bold?: boolean
  italic?: boolean
  underline?: boolean
  strike?: boolean
  color?: string
  highlight?: string
  fontId?: string
  size?: number
}
export type Paragraph = Record<string, unknown>
export type Page = {
  width: number
  height: number
  orientation: "portrait" | "landscape"
  top: number
  bottom: number
  start: number
  end: number
}

const TWIPS_MAX = 31680
const HIGHLIGHT: Record<string, string> = {
  yellow: "#FFFF00",
  green: "#00FF00",
  cyan: "#00FFFF",
  magenta: "#FF00FF",
  blue: "#0000FF",
  red: "#FF0000",
  darkBlue: "#000080",
  darkCyan: "#008080",
  darkGreen: "#008000",
  darkMagenta: "#800080",
  darkRed: "#800000",
  darkYellow: "#808000",
  darkGray: "#808080",
  lightGray: "#C0C0C0",
  black: "#000000",
  white: "#FFFFFF",
}
const MONO = /mono|courier|consolas|menlo|code/i
const SERIF =
  /serif|times|georgia|cambria|garamond|book antiqua|palatino|baskerville/i

function fontIdOf(name: string | undefined) {
  if (!name) return undefined
  if (MONO.test(name)) return "liberation-mono"
  if (/sans/i.test(name)) return "liberation-sans"
  if (SERIF.test(name)) return "liberation-serif"
  return "liberation-sans"
}

function twips(raw: string | undefined, min = 0) {
  if (raw === undefined) return undefined
  const value = Math.round(Number(raw))
  if (!Number.isFinite(value) || value < min) return undefined
  return Math.min(value, TWIPS_MAX)
}

function hex(raw: string | undefined) {
  if (!raw || !/^[0-9a-fA-F]{6}$/.test(raw)) return undefined
  return `#${raw.toUpperCase()}`
}

function toggle(props: XmlElement | undefined, name: string) {
  const node = props && wordChild(props, name)
  if (!node) return undefined
  const value = wordAttribute(node, "val")
  return value !== "0" && value !== "false" && value !== "none"
}

export function runLook(props: XmlElement | undefined): Omit<Run, "text"> {
  if (!props) return {}
  const look: Omit<Run, "text"> = {}
  const bold = toggle(props, "b")
  if (bold !== undefined) look.bold = bold
  const italic = toggle(props, "i")
  if (italic !== undefined) look.italic = italic
  const strike = toggle(props, "strike")
  if (strike !== undefined) look.strike = strike
  const underline = wordChild(props, "u")
  if (underline) look.underline = wordAttribute(underline, "val") !== "none"
  const color = hex(wordAttribute(wordChild(props, "color") ?? props, "val"))
  if (color && wordChild(props, "color")) look.color = color
  const mark = wordChild(props, "highlight")
  const shading = wordChild(props, "shd")
  const highlight =
    (mark && HIGHLIGHT[wordAttribute(mark, "val") ?? ""]) ||
    (shading && hex(wordAttribute(shading, "fill")))
  if (highlight) look.highlight = highlight
  const size = Number(wordAttribute(wordChild(props, "sz") ?? props, "val"))
  if (wordChild(props, "sz") && Number.isInteger(size)) {
    const twentieths = size * 10
    if (twentieths >= 80 && twentieths <= 2880) look.size = twentieths
  }
  const fonts = wordChild(props, "rFonts")
  const font = fontIdOf(
    fonts && (wordAttribute(fonts, "ascii") ?? wordAttribute(fonts, "hAnsi"))
  )
  if (font) look.fontId = font
  return look
}

export function paragraphLook(props: XmlElement | undefined): Paragraph {
  if (!props) return {}
  const look: Paragraph = {}
  const align = wordAttribute(wordChild(props, "jc") ?? props, "val")
  if (wordChild(props, "jc")) {
    const alignment =
      align === "both" || align === "distribute"
        ? "justify"
        : align === "center"
          ? "center"
          : align === "right" || align === "end"
            ? "right"
            : align === "left" || align === "start"
              ? "left"
              : undefined
    if (alignment) look.alignment = alignment
  }
  const spacing = wordChild(props, "spacing")
  if (spacing) {
    const before = twips(wordAttribute(spacing, "before"))
    if (before !== undefined) look.before = before
    const after = twips(wordAttribute(spacing, "after"))
    if (after !== undefined) look.after = after
    const line = Number(wordAttribute(spacing, "line"))
    const rule = wordAttribute(spacing, "lineRule") ?? "auto"
    if (Number.isInteger(line) && line > 0) {
      if (rule === "auto" && line >= 120 && line <= 2400)
        look.lineSpacing = { kind: "multiple", value: line / 240 }
      else if (rule === "exact" && line >= 20 && line <= TWIPS_MAX)
        look.lineSpacing = { kind: "exact", value: line }
      else if (rule === "atLeast" && line >= 20 && line <= TWIPS_MAX)
        look.lineSpacing = { kind: "atleast", value: line }
    }
  }
  const indent = wordChild(props, "ind")
  if (indent) {
    const hanging = twips(wordAttribute(indent, "hanging"))
    const first = twips(wordAttribute(indent, "firstLine"))
    const start = twips(
      wordAttribute(indent, "left") ?? wordAttribute(indent, "start")
    )
    const end = twips(
      wordAttribute(indent, "right") ?? wordAttribute(indent, "end")
    )
    if (start !== undefined && start > 0) look.start = start
    if (end !== undefined && end > 0) look.end = end
    if (hanging) look.indent = { kind: "hanging", value: hanging }
    else if (first) look.indent = { kind: "firstline", value: first }
  }
  if (toggle(props, "keepNext")) look.keepNext = true
  if (toggle(props, "keepLines")) look.keepTogether = true
  return look
}

export function levelOfOutline(outline: number): 2 | 3 | undefined {
  if (!Number.isInteger(outline) || outline < 0 || outline > 8) return undefined
  return outline <= 1 ? 2 : 3
}

export type Styles = Map<
  string,
  {
    level?: 2 | 3
    run: Omit<Run, "text">
    paragraph: Paragraph
    numbering?: XmlElement
  }
>

export function stylesOf(xml: XmlElement | null): Styles {
  const styles: Styles = new Map()
  if (!xml) return styles
  for (const style of xml.children.filter((node) => isWord(node, "style"))) {
    const id = wordAttribute(style, "styleId")
    if (!id) continue
    const name = (
      wordAttribute(wordChild(style, "name") ?? style, "val") ?? id
    ).toLowerCase()
    const outline = Number(
      wordAttribute(
        wordChild(wordChild(style, "pPr") ?? style, "outlineLvl") ?? style,
        "val"
      )
    )
    const numbered = /^heading\s*([1-9])$/.exec(name)
    const heading = name.startsWith("title")
      ? 2
      : numbered
        ? levelOfOutline(Number(numbered[1]) - 1)
        : wordChild(style, "pPr")
          ? levelOfOutline(outline)
          : undefined
    const numberingOfStyle = wordChild(
      wordChild(style, "pPr") ?? style,
      "numPr"
    )
    styles.set(id, {
      ...(heading ? { level: heading as 2 | 3 } : {}),
      run: runLook(wordChild(style, "rPr")),
      paragraph: paragraphLook(wordChild(style, "pPr")),
      ...(numberingOfStyle ? { numbering: numberingOfStyle } : {}),
    })
  }
  return styles
}

export function numberingOf(xml: XmlElement | null) {
  const kinds = new Map<string, "bullet" | "numbered">()
  if (!xml) return kinds
  const abstract = new Map<string, "bullet" | "numbered">()
  for (const node of xml.children.filter((child) =>
    isWord(child, "abstractNum")
  )) {
    const first = node.children.find((child) => isWord(child, "lvl"))
    const format =
      first && wordAttribute(wordChild(first, "numFmt") ?? first, "val")
    abstract.set(
      wordAttribute(node, "abstractNumId") ?? "",
      format === "bullet" || format === undefined ? "bullet" : "numbered"
    )
  }
  for (const node of xml.children.filter((child) => isWord(child, "num"))) {
    const link = wordChild(node, "abstractNumId")
    kinds.set(
      wordAttribute(node, "numId") ?? "",
      abstract.get((link && wordAttribute(link, "val")) ?? "") ?? "bullet"
    )
  }
  return kinds
}

export function pageOf(sectPr: XmlElement | undefined, fallback: Page): Page {
  if (!sectPr) return fallback
  const size = wordChild(sectPr, "pgSz")
  const margin = wordChild(sectPr, "pgMar")
  const width = twips(size && wordAttribute(size, "w"), 2880) ?? fallback.width
  const height =
    twips(size && wordAttribute(size, "h"), 2880) ?? fallback.height
  const side = (name: string, otherwise: number) =>
    twips(margin && wordAttribute(margin, name)) ?? otherwise
  const page = {
    width,
    height,
    orientation:
      size && wordAttribute(size, "orient") === "landscape"
        ? ("landscape" as const)
        : ("portrait" as const),
    top: side("top", fallback.top),
    bottom: side("bottom", fallback.bottom),
    start: side("left", fallback.start),
    end: side("right", fallback.end),
  }
  return page.width - page.start - page.end >= 2880 ? page : fallback
}
