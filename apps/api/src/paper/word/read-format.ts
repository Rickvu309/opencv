import {
  paperEngineBlank,
  type Block,
  type Mark,
  type PageSetup,
  type SafeHref,
} from "@workspace/domain/paper-doc"

import {
  isWord,
  wordAttribute,
  wordChild,
  type XmlElement,
} from "../import/package-xml.js"

import { numberedFormat } from "./word-styles.js"

type TextAttrs = Extract<Block, { type: "text_block" }>["attrs"]
type Font = Extract<Mark, { type: "font" }>["attrs"]["family"]
type Level = TextAttrs["level"]

const levels: readonly Level[] = [0, 1, 2, 3, 4, 5, 6, 7, 8]
const blankPage = paperEngineBlank.blankCv().attrs.page

export const children = (node: XmlElement | undefined, name: string) =>
  node?.children.filter((child) => isWord(child, name)) ?? []
export const attr = (node: XmlElement | undefined, name: string) =>
  node && wordAttribute(node, name)
export const value = (node: XmlElement | undefined, name: string) =>
  attr(node && wordChild(node, name), "val")

function integer(input: string | undefined) {
  if (!input || !/^-?\d+$/u.test(input)) return undefined
  const result = Number(input)
  return Number.isSafeInteger(result) ? result : undefined
}

export function positive(value: string | undefined, units = 1) {
  const result = Math.round((integer(value) ?? 0) * units)
  return Number.isSafeInteger(result) && result > 0 ? result : undefined
}

export function pageOf(
  section: XmlElement | undefined,
  dropped: Set<string>
): PageSetup {
  if (!section) return blankPage
  const size = wordChild(section, "pgSz")
  const margin = wordChild(section, "pgMar")
  const width = positive(attr(size, "w"))
  const height = positive(attr(size, "h"))
  const orientation =
    attr(size, "orient") === "landscape" || (width && height && width > height)
      ? "landscape"
      : "portrait"
  const short = Math.min(width ?? 0, height ?? 0)
  const long = Math.max(width ?? 0, height ?? 0)
  const letter = short === 12240 && long === 15840
  const a4 = Math.abs(short - 11906) <= 4 && Math.abs(long - 16838) <= 4
  if (size && !letter && !a4)
    dropped.add("The custom page size was changed to A4.")

  function side(name: keyof PageSetup["marginsMpt"]) {
    const twips = integer(attr(margin, name))
    const mpt = (twips ?? -1) * 50
    return mpt >= 0 && Number.isSafeInteger(mpt)
      ? mpt
      : blankPage.marginsMpt[name]
  }

  return {
    size: letter ? "Letter" : "A4",
    orientation,
    marginsMpt: {
      top: side("top"),
      right: side("right"),
      bottom: side("bottom"),
      left: side("left"),
    },
  }
}

const styleKinds = new Map<string, TextAttrs["kind"]>([
  ["title", "title"],
  ["titre", "title"],
  ["titulo", "title"],
  ["titel", "title"],
  ["tieude", "title"],
  ["标题", "title"],
  ["標題", "title"],
  ["タイトル", "title"],
  ["subtitle", "subtitle"],
  ["soustitre", "subtitle"],
  ["subtitulo", "subtitle"],
  ["untertitel", "subtitle"],
  ["tieudephu", "subtitle"],
  ["副标题", "subtitle"],
  ["副標題", "subtitle"],
  ["サブタイトル", "subtitle"],
  ["heading1", "heading"],
  ["heading2", "subheading"],
])

function knownKind(names: (string | undefined)[]) {
  for (const name of names) {
    const key = name
      ?.toLowerCase()
      .normalize("NFKD")
      .replace(/[^\p{L}\p{N}]/gu, "")
    const kind = key && styleKinds.get(key)
    if (kind) return kind
  }
  return undefined
}

export function stylesOf(root: XmlElement | undefined) {
  const styles = new Map<string, XmlElement>()
  for (const style of children(root, "style")) {
    const id = attr(style, "styleId")
    if (id) styles.set(id, style)
  }

  function chain(id: string | undefined) {
    const chain: XmlElement[] = []
    const seen = new Set<string>()
    while (id && seen.size < 64 && !seen.has(id)) {
      seen.add(id)
      const style = styles.get(id)
      if (!style) break
      chain.push(style)
      id = value(style, "basedOn")
    }
    return chain
  }

  return { chain }
}

export function paragraphFormat(
  paragraph: XmlElement,
  styles: ReturnType<typeof stylesOf>
) {
  const direct = wordChild(paragraph, "pPr")
  const styleId = value(direct, "pStyle")
  const chain = styles.chain(styleId)
  const properties = [direct, ...chain.map((style) => wordChild(style, "pPr"))]
  function property(name: string) {
    for (const props of properties) {
      const found = props && wordChild(props, name)
      if (found) return found
    }
    return undefined
  }
  const kind = knownKind([
    styleId,
    ...chain.flatMap((style) => [
      attr(style, "styleId"),
      value(style, "name"),
      ...(value(style, "aliases")?.split(",") ?? []),
    ]),
  ])
  const outline = attr(property("outlineLvl"), "val")
  const align = attr(property("jc"), "val")
  const spacing = direct && wordChild(direct, "spacing")
  const line = positive(attr(spacing, "line"))
  const keep = direct && wordChild(direct, "keepNext")
  const rightTab = children(property("tabs"), "tab").find((tab) =>
    ["right", "end"].includes(attr(tab, "val") ?? "")
  )
  return {
    kind:
      kind ??
      (outline === "0"
        ? "heading"
        : outline === "1"
          ? "subheading"
          : "paragraph"),
    align:
      align === "both"
        ? "justify"
        : align === "right" || align === "end"
          ? "right"
          : align === "center"
            ? "center"
            : "left",
    rightTabMpt: positive(attr(rightTab, "pos"), 50),
    lineSpacing:
      line && [undefined, "auto"].includes(attr(spacing, "lineRule"))
        ? line / 240
        : null,
    keepWithNext: keep ? enabled(attr(keep, "val")) : null,
    numbering: properties.flatMap((props) => children(props, "numPr")),
  } satisfies Partial<TextAttrs> & { numbering: XmlElement[] }
}

export function numberingOf(root: XmlElement | undefined) {
  function definitions(nodes: XmlElement[], idName: string) {
    const indexed = new Map<string, XmlElement>()
    for (const node of nodes) {
      const id = attr(node, idName)
      if (id) indexed.set(id, node)
    }
    return indexed
  }

  function formatsOf(nodes: XmlElement[], overrides: boolean) {
    const formats = new Map<string, string>()
    for (const node of nodes) {
      const level = attr(node, "ilvl")
      const format = value(overrides ? wordChild(node, "lvl") : node, "numFmt")
      if (level && /^[0-8]$/u.test(level) && format) formats.set(level, format)
    }
    return formats
  }

  const abstracts = new Map(
    [...definitions(children(root, "abstractNum"), "abstractNumId")].map(
      ([id, node]) => [id, formatsOf(children(node, "lvl"), false)]
    )
  )
  const formats = new Map(
    [...definitions(children(root, "num"), "numId")].map(([id, node]) => [
      id,
      {
        base: abstracts.get(value(node, "abstractNumId") ?? ""),
        overrides: formatsOf(children(node, "lvlOverride"), true),
      },
    ])
  )

  return (
    properties: XmlElement[],
    dropped: Set<string>
  ): Pick<TextAttrs, "list" | "level"> => {
    const id = properties
      .map((props) => value(props, "numId"))
      .find((id) => id !== undefined)
    if (!id || id === "0") return { list: null, level: 0 }
    const level =
      properties
        .map((props) => value(props, "ilvl"))
        .find((level) => level !== undefined) ?? "0"
    const supportedLevel = levels[Number(level)]
    const byLevel = formats.get(id)
    const format = byLevel?.overrides.get(level) ?? byLevel?.base?.get(level)
    if (supportedLevel === undefined || !format || format === "none") {
      dropped.add("Some list markers were left out.")
      return { list: null, level: 0 }
    }
    if (format !== "bullet" && format !== numberedFormat(supportedLevel))
      dropped.add("Some list markers were converted to numbers.")
    return {
      list: format === "bullet" ? "bullet" : "numbered",
      level: supportedLevel,
    }
  }
}

const fonts = new Map<string, Font>([
  ["arial", "Liberation Sans"],
  ["liberation sans", "Liberation Sans"],
  ["times new roman", "Liberation Serif"],
  ["liberation serif", "Liberation Serif"],
  ["cambria", "Liberation Serif"],
  ["courier new", "Liberation Mono"],
  ["liberation mono", "Liberation Mono"],
  ["calibri", "Carlito"],
  ["carlito", "Carlito"],
])

function enabled(input: string | undefined) {
  return input !== "0" && input !== "false" && input !== "off"
}

export function marksOf(
  run: XmlElement,
  styles: ReturnType<typeof stylesOf>,
  href: SafeHref | undefined,
  dropped: Set<string>
) {
  const direct = wordChild(run, "rPr")
  const style = value(direct, "rStyle")
  const properties = [
    direct,
    ...styles
      .chain(style === "Hyperlink" ? undefined : style)
      .map((node) => wordChild(node, "rPr")),
  ]
  function property(name: string) {
    return properties.flatMap((props) => children(props, name))[0]
  }
  const marks: Mark[] = []
  const bold = property("b")
  const italic = property("i")
  const underline = property("u")
  const strike = property("strike") ?? property("dstrike")
  if (bold && enabled(attr(bold, "val"))) marks.push({ type: "bold" })
  if (italic && enabled(attr(italic, "val"))) marks.push({ type: "italic" })
  if (
    underline &&
    attr(underline, "val") !== "none" &&
    enabled(attr(underline, "val"))
  )
    marks.push({ type: "underline" })
  if (strike && enabled(attr(strike, "val"))) marks.push({ type: "strike" })
  if (href) marks.push({ type: "link", attrs: { href } })
  const color = attr(property("color"), "val")
  if (color && /^[a-f\d]{6}$/iu.test(color))
    marks.push({ type: "color", attrs: { value: `#${color.toLowerCase()}` } })
  const rFonts = property("rFonts")
  const font = (
    attr(rFonts, "ascii") ??
    attr(rFonts, "hAnsi") ??
    attr(rFonts, "eastAsia") ??
    attr(rFonts, "cs")
  )
    ?.trim()
    .toLowerCase()
  const family = font && fonts.get(font)
  if (family) marks.push({ type: "font", attrs: { family } })
  if (font === "cambria")
    dropped.add("Cambria was replaced with Liberation Serif.")
  else if (font && !family)
    dropped.add("Some fonts were replaced with Paper’s default font.")
  const mpt = positive(attr(property("sz"), "val"), 500)
  if (mpt) marks.push({ type: "size", attrs: { mpt } })
  return marks
}
