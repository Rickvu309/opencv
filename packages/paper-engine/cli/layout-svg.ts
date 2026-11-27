import { writeFileSync } from "node:fs"

import {
  createLayouter,
  paperFontMetrics,
  type Box,
  type Page,
} from "../src/index.js"
import { readCorpusCv } from "./corpus-cv.js"

const [id = "en-10", out = `${id}.svg`] = process.argv.slice(2)
const GAP = 24
const pt = (mpt: number) => (mpt / 1000).toFixed(3)
const escape = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")

function fontAttributes(face: string) {
  const family = face.startsWith("liberation-serif")
    ? "Liberation Serif"
    : face.startsWith("liberation-mono")
      ? "Liberation Mono"
      : face.startsWith("carlito")
        ? "Carlito"
        : "Liberation Sans"
  const weight = face.includes("bold") ? "bold" : "normal"
  const style = face.includes("italic") ? "italic" : "normal"
  return `font-family="${family}" font-weight="${weight}" font-style="${style}"`
}

function drawBox(box: Box): string {
  const { rect } = box
  if (box.kind === "cell") {
    return box.borders === "all"
      ? `<rect x="${pt(rect.x)}" y="${pt(rect.y)}" width="${pt(rect.w)}" height="${pt(rect.h)}" fill="none" stroke="#999" stroke-width="0.5"/>`
      : ""
  }
  if (box.kind === "image") {
    return `<rect x="${pt(rect.x)}" y="${pt(rect.y)}" width="${pt(rect.w)}" height="${pt(rect.h)}" fill="#e8eef7" stroke="#8aa"/>`
  }
  if (box.kind === "rule") {
    return `<rect x="${pt(rect.x)}" y="${pt(rect.y)}" width="${pt(rect.w)}" height="${pt(rect.h)}" fill="#999"/>`
  }
  if (box.kind === "break") return ""
  const parts = box.segments.map(
    (segment) =>
      `<text x="${pt(segment.x)}" y="${pt(box.baseline)}" textLength="${pt(segment.w)}" lengthAdjust="spacingAndGlyphs" font-size="${pt(segment.sizeMpt)}" ${fontAttributes(segment.font)} fill="${segment.color}" xml:space="preserve"${segment.underline ? ' text-decoration="underline"' : ""}>${escape(segment.text)}</text>`
  )
  if (box.marker) {
    parts.unshift(
      `<text x="${pt(box.marker.x)}" y="${pt(box.baseline)}" font-size="${pt(box.marker.sizeMpt)}" ${fontAttributes(box.marker.font)}>${escape(box.marker.text)}</text>`
    )
  }
  return parts.join("")
}

function drawPage(page: Page, top: number): string {
  const { size, content } = page
  return [
    `<g transform="translate(0 ${top.toFixed(3)})">`,
    `<rect width="${pt(size.w)}" height="${pt(size.h)}" fill="#fff" stroke="#ccc"/>`,
    `<rect x="${pt(content.x)}" y="${pt(content.y)}" width="${pt(content.w)}" height="${pt(content.h)}" fill="none" stroke="#f0d0d0" stroke-dasharray="2 2"/>`,
    ...page.boxes.map(drawBox),
    "</g>",
  ].join("\n")
}

const layout = createLayouter(paperFontMetrics).layout(readCorpusCv(id), null)
const pageHeight = layout.pages[0]!.size.h / 1000
const width = layout.pages[0]!.size.w / 1000
const height = layout.pages.length * (pageHeight + GAP) - GAP
const svg = [
  `<svg xmlns="http://www.w3.org/2000/svg" width="${width}pt" height="${height.toFixed(3)}pt" viewBox="0 0 ${width} ${height.toFixed(3)}">`,
  `<rect width="100%" height="100%" fill="#f4f4f5"/>`,
  ...layout.pages.map((page) =>
    drawPage(page, page.index * (pageHeight + GAP))
  ),
  "</svg>",
].join("\n")
writeFileSync(out, svg)
console.log(JSON.stringify({ id, pages: layout.pages.length, out }))
