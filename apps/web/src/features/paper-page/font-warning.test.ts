import { expect, it, vi } from "vitest"

import { fontFacts } from "./font-file.ts"
import {
  clearLoadedFaces,
  faceLoaded,
  fontFacesFromXml,
  fontSentence,
  fontWarning,
  type FontFace,
} from "./font-warning.ts"

const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"

function face(family: string, bold = false, italic = false): FontFace {
  return { family, bold, italic }
}

function u16(value: number) {
  return Uint8Array.of((value >> 8) & 255, value & 255)
}

function u32(value: number) {
  return Uint8Array.of(
    (value >>> 24) & 255,
    (value >>> 16) & 255,
    (value >>> 8) & 255,
    value & 255
  )
}

function concat(parts: Uint8Array[]) {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0))
  let cursor = 0
  for (const part of parts) {
    out.set(part, cursor)
    cursor += part.length
  }
  return out
}

function pad4(bytes: Uint8Array) {
  const extra = (4 - (bytes.length % 4)) % 4
  return extra ? concat([bytes, new Uint8Array(extra)]) : bytes
}

function nameTable(copyright: string) {
  const units = [...copyright].map((char) => char.charCodeAt(0))
  const encoded = new Uint8Array(units.length * 2)
  units.forEach((unit, index) => {
    encoded[index * 2] = (unit >> 8) & 255
    encoded[index * 2 + 1] = unit & 255
  })
  return concat([
    u16(0),
    u16(1),
    u16(6 + 12),
    u16(3),
    u16(1),
    u16(0x409),
    u16(0),
    u16(encoded.length),
    u16(0),
    encoded,
  ])
}

function sampleFont(weight: number, italic: boolean) {
  const os2 = new Uint8Array(96)
  os2.set(u16(4), 0)
  os2.set(u16(weight), 4)
  os2.set(u16(italic ? 1 : 64), 62)
  const name = nameTable("Copyright sample")
  const tables = [
    ["OS/2", os2],
    ["name", name],
  ] as const
  const body = tables.map(([, bytes]) => pad4(bytes))
  const count = tables.length
  const directory = [u32(0x00010000), u16(count), u16(0), u16(0), u16(0)]
  let offset = 12 + count * 16
  const rows: Uint8Array[] = []
  for (const [label, bytes] of tables) {
    rows.push(
      concat([
        new TextEncoder().encode(label),
        u32(0),
        u32(offset),
        u32(bytes.length),
      ])
    )
    offset += pad4(bytes).length
  }
  return concat([...directory, ...rows, ...body])
}

class LoadedFace {
  status = "unloaded"
  load() {
    this.status = "loaded"
    return Promise.resolve(this)
  }
}

function installFonts(files: Record<string, Uint8Array>) {
  clearLoadedFaces()
  vi.stubGlobal("FontFace", LoadedFace)
  vi.stubGlobal("fetch", (url: string) => {
    const body = files[url]
    if (!body) {
      return Promise.resolve({
        ok: false,
        arrayBuffer: async () => new ArrayBuffer(0),
      })
    }
    const copy = body.buffer.slice(
      body.byteOffset,
      body.byteOffset + body.byteLength
    )
    return Promise.resolve({
      ok: true,
      arrayBuffer: async () => copy,
    })
  })
  Object.defineProperty(document, "fonts", {
    configurable: true,
    value: { add() {} },
  })
}

it("names a loaded replacement and refuses one that did not load", async () => {
  const loaded = [
    face("Calibri"),
    face("Century Gothic"),
    face("Montserrat Light"),
    face("Open Sans"),
    face("Courier New"),
    face("Times New Roman"),
    face("Aptos"),
    face("Georgia"),
  ]
  const notice = loaded.map((item) => fontSentence(item, true)).join(" ")
  expect(notice).toContain(
    "Calibri is shown using Carlito (metric-compatible)."
  )
  expect(notice).toContain(
    "Century Gothic is shown using Jost (different metrics)."
  )
  expect(notice).toContain(
    "Montserrat Light is shown using Montserrat (Light instance not certified)."
  )
  expect(notice).toContain("Open Sans is the original font.")
  expect(notice).toContain(
    "Courier New is shown using Liberation Mono (metric-compatible)."
  )
  expect(notice).toContain(
    "Times New Roman is shown using Liberation Serif (metric-compatible)."
  )
  expect(notice).toContain(
    "Aptos is shown using Liberation Sans (no certified equivalent)."
  )
  expect(notice).toContain(
    "Georgia is shown using Liberation Serif (no certified equivalent)."
  )
  expect(notice).not.toContain("Fonts substituted")
  const missing = await fontWarning([
    face("Calibri"),
    face("Symbol"),
    face("Wingdings"),
    face("Montserrat Thin"),
  ])
  expect(missing).toContain("Calibri is shown using no shipped file.")
  expect(missing).toContain("Symbol is shown using no shipped file.")
  expect(missing).toContain("Montserrat Thin is shown using no shipped file.")
  expect(missing).not.toContain("Carlito")
  expect(missing).not.toContain("Liberation")
})

it("says an italic run is missing when that file did not load", async () => {
  installFonts({
    "/fonts/OpenSans.ttf": sampleFont(400, false),
  })
  const italic = face("Open Sans", false, true)
  expect(await faceLoaded(italic)).toBe(false)
  expect(fontSentence(italic, false)).toBe(
    "Open Sans italic is shown using no shipped file."
  )
  expect(fontSentence(italic, true)).toBe(
    "Open Sans italic is the original font."
  )
})

it("paints Open Sans italic only from the italic file", async () => {
  const italic = face("Open Sans", false, true)
  installFonts({
    "/fonts/OpenSans-Italic.ttf": sampleFont(400, false),
  })
  expect(await faceLoaded(italic)).toBe(false)
  installFonts({
    "/fonts/OpenSans-Italic.ttf": sampleFont(400, true),
  })
  expect(fontCoversItalic(await fontFacts(sampleFont(400, true)))).toBe(true)
  expect(await faceLoaded(italic)).toBe(true)
  expect(fontSentence(italic, true)).toBe(
    "Open Sans italic is the original font."
  )
})

function fontCoversItalic(facts: ReturnType<typeof fontFacts>) {
  return facts.italic && facts.weightMin <= 400 && facts.weightMax >= 400
}

it("reads bold and italic from the run", () => {
  const xml = `<w:document xmlns:w="${W}"><w:r><w:rPr><w:rFonts w:ascii="Open Sans" w:hAnsi="Open Sans"/><w:b w:val="0"/><w:i/></w:rPr><w:t>Start-Ups</w:t></w:r></w:document>`
  expect(fontFacesFromXml([xml])).toEqual([face("Open Sans", false, true)])
})

it("reads the typeface from the word markup", async () => {
  const xml = `<w:document xmlns:w="${W}"><w:rFonts w:ascii="Georgia" w:hAnsi="Georgia"/></w:document>`
  expect(await fontWarning(fontFacesFromXml([xml]))).toBe(
    "Georgia is shown using no shipped file."
  )
  expect(fontSentence(face("Georgia"), true)).toBe(
    "Georgia is shown using Liberation Serif (no certified equivalent)."
  )
})
