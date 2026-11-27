import type { Block, Document } from "@workspace/domain/paper-doc"

import { WORD_NS } from "../import/package-xml.js"
import { val, wordFont } from "./word-xml.js"

export const styleIds = {
  title: "Title",
  subtitle: "Subtitle",
  heading: "Heading1",
  subheading: "Heading2",
  paragraph: "Normal",
}

export function stylesXml(template: Document["attrs"]["template"]) {
  const letter = template === "letter"
  const modern = template === "modern"
  const font = wordFont(letter ? "Liberation Serif" : "Liberation Sans")
  const normalSize = letter ? 24 : 22
  const style = (id: string, name: string, pPr: string, rPr = "") =>
    `<w:style w:type="paragraph" w:styleId="${id}"${id === "Normal" ? ' w:default="1"' : ""}>` +
    `${val("name", name)}${id === "Normal" ? "" : val("basedOn", "Normal")}` +
    `<w:qFormat/><w:pPr>${pPr}</w:pPr>${rPr ? `<w:rPr>${rPr}</w:rPr>` : ""}</w:style>`
  const spacing = (before: number, after: number) =>
    `<w:spacing w:before="${before}" w:after="${after}"/>`
  return (
    `<w:styles xmlns:w="${WORD_NS}">` +
    style(
      "Normal",
      "Normal",
      `<w:spacing w:after="${letter ? 200 : 60}" w:line="240" w:lineRule="auto"/>`,
      font + val("sz", normalSize)
    ) +
    style(
      "Title",
      "Title",
      spacing(0, letter ? 120 : 40),
      "<w:b/>" + val("sz", letter ? 32 : modern ? 48 : 42)
    ) +
    style(
      "Subtitle",
      "Subtitle",
      spacing(0, letter ? 200 : 160),
      val("color", letter ? "000000" : "444444") + val("sz", letter ? 24 : 26)
    ) +
    style(
      "Heading1",
      "heading 1",
      "<w:keepNext/>" + spacing(letter ? 160 : 200, 60) + val("outlineLvl", 0),
      "<w:b/>" + val("color", modern ? "1F3A5F" : "000000") + val("sz", 26)
    ) +
    style(
      "Heading2",
      "heading 2",
      "<w:keepNext/>" + spacing(80, letter ? 60 : 20) + val("outlineLvl", 1),
      "<w:b/>" + val("sz", normalSize)
    ) +
    style("ListParagraph", "List Paragraph", spacing(0, 20)) +
    `<w:style w:type="character" w:styleId="Hyperlink">${val("name", "Hyperlink")}<w:rPr>${val("color", "1155CC")}${val("u", "single")}</w:rPr></w:style></w:styles>`
  )
}

type ListKind = NonNullable<
  Extract<Block, { type: "text_block" }>["attrs"]["list"]
>
const listIds = { bullet: 0, numbered: 1 }
const bullets = ["\u2022", "\u25e6", "\u25aa"]
const formats = ["decimal", "lowerLetter", "lowerRoman"]

export function numberingXml(lists: readonly ListKind[]) {
  function definition(kind: ListKind) {
    const levels = Array.from({ length: 9 }, (_, level) => {
      const indent = 360 * (level + 1)
      return (
        `<w:lvl w:ilvl="${level}">` +
        val("start", 1) +
        val("numFmt", kind === "bullet" ? "bullet" : formats[level % 3]) +
        val(
          "lvlText",
          kind === "bullet" ? bullets[level % 3] : `%${level + 1}.`
        ) +
        val("lvlJc", "left") +
        `<w:pPr><w:tabs><w:tab w:val="num" w:pos="${indent}"/></w:tabs><w:ind w:left="${indent}" w:hanging="360"/></w:pPr></w:lvl>`
      )
    })
    return `<w:abstractNum w:abstractNumId="${listIds[kind]}">${val("multiLevelType", "multilevel")}${levels.join("")}</w:abstractNum>`
  }

  const instances = lists.map(
    (kind, index) =>
      `<w:num w:numId="${index + 1}">${val("abstractNumId", listIds[kind])}</w:num>`
  )
  return `<w:numbering xmlns:w="${WORD_NS}">${definition("bullet")}${definition("numbered")}${instances.join("")}</w:numbering>`
}
