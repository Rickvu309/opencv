import type { Mark } from "@workspace/domain/paper-doc"

import fonts from "../../../../../packages/paper-fonts/fonts.json" with { type: "json" }
import { xmlCharacters } from "../import/package-xml.js"

export const officeRelationships =
  "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
export const drawing = "http://schemas.openxmlformats.org/drawingml/2006/main"
export const wordDrawing =
  "http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
export const picture =
  "http://schemas.openxmlformats.org/drawingml/2006/picture"

export function xml(text: string) {
  const safe = xmlCharacters(text)
    ? text
    : Array.from(text, (character) =>
        xmlCharacters(character) ? character : "\uFFFD"
      ).join("")
  return safe
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("\r", "&#13;")
    .replaceAll("\n", "&#10;")
    .replaceAll("\t", "&#9;")
}

export const val = (name: string, value: string | number) =>
  `<w:${name} w:val="${value}"/>`

export const twips = (mpt: number) => Math.round(mpt / 50)

type Family = Extract<Mark, { type: "font" }>["attrs"]["family"]
const wordNames = new Map(
  fonts.faces.map(({ family, wordName }) => [family, wordName])
)

export function wordFont(family: Family) {
  const name = wordNames.get(family.toLowerCase().replaceAll(" ", "-"))
  if (!name) throw new Error(`Missing Word font for ${family}`)
  const escaped = xml(name)
  return `<w:rFonts w:ascii="${escaped}" w:hAnsi="${escaped}" w:eastAsia="${escaped}" w:cs="${escaped}"/>`
}
