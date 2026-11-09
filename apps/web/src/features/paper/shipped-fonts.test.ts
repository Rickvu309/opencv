import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import path from "node:path"
import { expect, it } from "vitest"

const fonts = path.join(
  path.dirname(new URL(import.meta.url).pathname),
  "../../../public/fonts"
)

function readManifest() {
  return JSON.parse(
    readFileSync(path.join(fonts, "manifest.json"), "utf8")
  ) as {
    name: string
    bytes: number
    sha256: string
    license: string
  }[]
}

it("matches every shipped font to its hash", () => {
  const entries = readManifest()
  expect(entries).toHaveLength(18)
  for (const entry of entries) {
    const bytes = readFileSync(path.join(fonts, entry.name))
    const hash = createHash("sha256").update(bytes).digest("hex")
    expect(hash, entry.name).toBe(entry.sha256)
    expect(bytes.length, entry.name).toBe(entry.bytes)
    expect(entry.license, entry.name).toBe("SIL OFL 1.1")
  }
})

it("names each shipped font in the face sheet and leaves the missing ones out", () => {
  const css = readFileSync(path.join(fonts, "faces.css"), "utf8")
  for (const entry of readManifest()) {
    expect(css, entry.name).toContain(`/fonts/${entry.name}`)
  }
  for (const name of [
    "Wingdings",
    "Symbol",
    "Segoe UI Emoji",
    "Noto Sans Symbols",
  ]) {
    expect(css, name).not.toContain(name)
  }
})

it("names each family in the license notice", () => {
  const text = readFileSync(path.join(fonts, "NOTICES.txt"), "utf8")
  for (const name of [
    "Carlito",
    "Caladea",
    "Jost",
    "Montserrat",
    "Open Sans",
    "Liberation",
  ]) {
    expect(text, name).toContain(name)
  }
})

type FontFacts = {
  weightMin: number
  weightMax: number
  italic: boolean
  copyright: string
}

function u16(bytes: Uint8Array, offset: number) {
  return (bytes[offset]! << 8) | bytes[offset + 1]!
}

function u32(bytes: Uint8Array, offset: number) {
  return (
    ((bytes[offset]! << 24) |
      (bytes[offset + 1]! << 16) |
      (bytes[offset + 2]! << 8) |
      bytes[offset + 3]!) >>>
    0
  )
}

function tag(bytes: Uint8Array, offset: number) {
  return String.fromCharCode(
    bytes[offset]!,
    bytes[offset + 1]!,
    bytes[offset + 2]!,
    bytes[offset + 3]!
  )
}

function table(bytes: Uint8Array, name: string) {
  const count = u16(bytes, 4)
  for (let index = 0; index < count; index++) {
    const at = 12 + index * 16
    if (tag(bytes, at) !== name) continue
    const start = u32(bytes, at + 8)
    const length = u32(bytes, at + 12)
    return bytes.subarray(start, start + length)
  }
  return null
}

function characters(bytes: Uint8Array, platform: number) {
  if (platform === 0 || platform === 3) {
    let value = ""
    for (let index = 0; index + 1 < bytes.length; index += 2) {
      value += String.fromCharCode((bytes[index]! << 8) | bytes[index + 1]!)
    }
    return value.replace(/\0/g, "").trim()
  }
  return new TextDecoder("latin1").decode(bytes).replace(/\0/g, "").trim()
}

function fontFacts(bytes: Uint8Array): FontFacts {
  const os2 = table(bytes, "OS/2")
  const name = table(bytes, "name")
  const fvar = table(bytes, "fvar")
  const head = table(bytes, "head")
  if (!os2 || !name || os2.length < 64) throw new Error("Not a font file")
  let weightMin = u16(os2, 4)
  let weightMax = weightMin
  let italic = (u16(os2, 62) & 1) !== 0 || (u16(os2, 62) & 512) !== 0
  if (head && head[45] !== undefined && (u16(head, 44) & 2) !== 0) italic = true
  if (fvar && fvar[15] !== undefined && u16(fvar, 0) === 1) {
    const axesAt = u16(fvar, 4)
    const axisCount = u16(fvar, 8)
    const axisSize = u16(fvar, 10) || 20
    for (let index = 0; index < axisCount; index++) {
      const at = axesAt + index * axisSize
      if (at + 16 > fvar.length) break
      const axis = tag(fvar, at)
      if (axis === "ital" || axis === "slnt") italic = true
      if (axis !== "wght") continue
      weightMin = u32(fvar, at + 4) / 65536
      weightMax = u32(fvar, at + 12) / 65536
    }
  }
  const count = u16(name, 2)
  const stringOffset = u16(name, 4)
  let copyright = ""
  let fallback = ""
  for (let index = 0; index < count; index++) {
    const at = 6 + index * 12
    if (at + 12 > name.length) break
    if (u16(name, at + 6) !== 0) continue
    const length = u16(name, at + 8)
    const offset = u16(name, at + 10)
    const raw = name.subarray(
      stringOffset + offset,
      stringOffset + offset + length
    )
    const text = characters(raw, u16(name, at))
    if (!text) continue
    fallback ||= text
    if (u16(name, at) === 3 && u16(name, at + 4) === 0x409) copyright = text
  }
  return {
    weightMin,
    weightMax,
    italic,
    copyright: copyright || fallback,
  }
}

function declarationFits(
  facts: FontFacts,
  declared: { min: number; max: number; style: string }
) {
  return (
    declared.min >= facts.weightMin &&
    declared.max <= facts.weightMax &&
    declared.style === (facts.italic ? "italic" : "normal")
  )
}

function declaredFaces(css: string) {
  return css
    .split("@font-face")
    .slice(1)
    .map((block) => {
      const family = /font-family:\s*([^;]+);/.exec(block)?.[1] ?? ""
      const src = /url\("([^"]+)"\)/.exec(block)?.[1] ?? ""
      const weight = /font-weight:\s*([^;]+);/.exec(block)?.[1]?.trim() ?? ""
      const style = /font-style:\s*([^;]+);/.exec(block)?.[1]?.trim() ?? ""
      const parts = weight.split(/\s+/).map(Number)
      const trimmed = family.trim().replace(/^"|"$/g, "")
      return {
        family: trimmed,
        file: src.replace("/fonts/", ""),
        min: parts[0] ?? Number.NaN,
        max: parts[1] ?? parts[0] ?? Number.NaN,
        style,
      }
    })
}

function flat(value: string) {
  return value.replace(/\s+/g, " ").trim()
}

it("matches each face and copyright to the font file", () => {
  const css = readFileSync(path.join(fonts, "faces.css"), "utf8")
  const notice = flat(readFileSync(path.join(fonts, "NOTICES.txt"), "utf8"))
  const faces = declaredFaces(css)
  expect(faces.length).toBeGreaterThan(0)
  for (const entry of readManifest()) {
    const bytes = readFileSync(path.join(fonts, entry.name))
    const facts = fontFacts(bytes)
    expect(facts.copyright, entry.name).not.toBe("")
    expect(notice, entry.name).toContain(flat(facts.copyright))
    const declared = faces.filter((face) => face.file === entry.name)
    expect(declared.length, entry.name).toBeGreaterThan(0)
    for (const face of declared) {
      expect(declarationFits(facts, face), `${entry.name} ${face.family}`).toBe(
        true
      )
    }
  }
  expect(notice).toContain(
    "Copyright 2011 The Montserrat Project Authors (https://github.com/JulietaUla/Montserrat)"
  )
  expect(notice).not.toContain("Montserrat.Git")
  const openSans = fontFacts(readFileSync(path.join(fonts, "OpenSans.ttf")))
  expect(openSans).toMatchObject({
    weightMin: 300,
    weightMax: 800,
    italic: false,
  })
  expect(
    declarationFits(openSans, { min: 100, max: 900, style: "normal" })
  ).toBe(false)
  expect(
    declarationFits(openSans, { min: 300, max: 800, style: "italic" })
  ).toBe(false)
  const openItalic = fontFacts(
    readFileSync(path.join(fonts, "OpenSans-Italic.ttf"))
  )
  expect(openItalic).toMatchObject({
    weightMin: 300,
    weightMax: 800,
    italic: true,
  })
  expect(
    declarationFits(openItalic, { min: 300, max: 800, style: "normal" })
  ).toBe(false)
})
