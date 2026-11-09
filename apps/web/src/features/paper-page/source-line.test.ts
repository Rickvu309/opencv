import { deflateRawSync } from "node:zlib"
import { expect, it } from "vitest"

import {
  paintSourceLines,
  paragraphLines,
  readDocxParts,
  readZip,
  sourceLineNote,
} from "./source-line.ts"

const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"

function styles(line: string | null) {
  const spacing = line
    ? `<w:docDefaults><w:pPrDefault><w:pPr><w:spacing w:line="${line}" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>`
    : ""
  return `<w:styles xmlns:w="${W}">${spacing}</w:styles>`
}

function paragraph(text: string, line?: string) {
  const spacing = line
    ? `<w:pPr><w:spacing w:line="${line}" w:lineRule="auto"/></w:pPr>`
    : ""
  return `<w:p>${spacing}<w:r><w:t>${text}</w:t></w:r></w:p>`
}

function documentXml(body: string) {
  return `<w:document xmlns:w="${W}"><w:body>${body}</w:body></w:document>`
}

function crc32(data: Uint8Array) {
  let crc = ~0
  for (const byte of data) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit++) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1))
    }
  }
  return ~crc >>> 0
}

function zip(files: Record<string, Uint8Array>, method: 0 | 8) {
  const encoder = new TextEncoder()
  const locals: Uint8Array[] = []
  const centrals: Uint8Array[] = []
  let offset = 0
  for (const [name, raw] of Object.entries(files)) {
    const nameBytes = encoder.encode(name)
    const data = method === 8 ? deflateRawSync(raw) : raw
    const crc = crc32(raw)
    const local = new Uint8Array(30 + nameBytes.length + data.length)
    const view = new DataView(local.buffer)
    view.setUint32(0, 0x04034b50, true)
    view.setUint16(4, 20, true)
    view.setUint16(8, method, true)
    view.setUint32(14, crc, true)
    view.setUint32(18, data.length, true)
    view.setUint32(22, raw.length, true)
    view.setUint16(26, nameBytes.length, true)
    local.set(nameBytes, 30)
    local.set(data, 30 + nameBytes.length)
    const central = new Uint8Array(46 + nameBytes.length)
    const centralView = new DataView(central.buffer)
    centralView.setUint32(0, 0x02014b50, true)
    centralView.setUint16(4, 20, true)
    centralView.setUint16(6, 20, true)
    centralView.setUint16(10, method, true)
    centralView.setUint32(16, crc, true)
    centralView.setUint32(20, data.length, true)
    centralView.setUint32(24, raw.length, true)
    centralView.setUint16(28, nameBytes.length, true)
    centralView.setUint32(42, offset, true)
    central.set(nameBytes, 46)
    locals.push(local)
    centrals.push(central)
    offset += local.length
  }
  const centralSize = centrals.reduce((sum, part) => sum + part.length, 0)
  const end = new Uint8Array(22)
  const endView = new DataView(end.buffer)
  endView.setUint32(0, 0x06054b50, true)
  endView.setUint16(8, centrals.length, true)
  endView.setUint16(10, centrals.length, true)
  endView.setUint32(12, centralSize, true)
  endView.setUint32(16, offset, true)
  const out = new Uint8Array(offset + centralSize + 22)
  let cursor = 0
  for (const part of [...locals, ...centrals, end]) {
    out.set(part, cursor)
    cursor += part.length
  }
  return out
}

it("reads a stored word part and a deflated word part", async () => {
  const encoder = new TextEncoder()
  const stored = zip(
    { "word/document.xml": encoder.encode("<w:document/>") },
    0
  )
  const deflated = zip(
    { "word/styles.xml": encoder.encode("<w:styles>264</w:styles>") },
    8
  )
  expect(
    new TextDecoder().decode((await readZip(stored)).get("word/document.xml"))
  ).toBe("<w:document/>")
  expect(
    new TextDecoder().decode((await readZip(deflated)).get("word/styles.xml"))
  ).toBe("<w:styles>264</w:styles>")
})

it("uses the document default, then the paragraph line, else 240", () => {
  const body = [
    paragraph("Date"),
    paragraph("Greeting", "249"),
    paragraph("Body"),
  ].join("")
  expect(sourceLineNote(documentXml(body), styles("264"))).toBe(
    "Line spacing is the source 264 (1.10) on 2 paragraphs; 249 (1.04) on 1 paragraphs."
  )
  const lines = paragraphLines(documentXml(body), styles(null))
  expect(lines.map((row) => row.line)).toEqual(["240", "249", "240"])
})

it("keeps the raw source line text, including a long decimal", () => {
  const body = paragraph("Rule", "276.0005454545455")
  expect(sourceLineNote(documentXml(body), styles(null))).toBe(
    "Line spacing is the source 276.0005454545455 (1.15) on 1 paragraphs."
  )
})

it("marks the matching page paragraph and skips one extra empty host", () => {
  const root = document.createElement("div")
  root.innerHTML = `<section class="docx"><article>
    <p></p><p>April 30, 2023</p><p>Mr. Curtis:</p>
  </article></section>`
  const body = paragraph("April 30, 2023") + paragraph("Mr. Curtis:")
  const note = paintSourceLines(root, documentXml(body), styles("240"))
  const hosts = [...root.querySelectorAll("article p")]
  expect(hosts[0]?.dataset.line).toBeUndefined()
  expect(hosts[1]?.dataset.line).toBe("240")
  expect(hosts[2]?.dataset.line).toBe("240")
  expect(note).toBe("Line spacing is the source 240 (1.00) on 2 paragraphs.")
})

it("does not give a blank paragraph the next source line", () => {
  const root = document.createElement("div")
  root.innerHTML = `<section class="docx"><article>
    <p></p><p>Mr. Curtis:</p>
  </article></section>`
  const body = paragraph("April 30, 2023") + paragraph("Mr. Curtis:")
  const note = paintSourceLines(root, documentXml(body), styles("240"))
  const hosts = [...root.querySelectorAll("article p")]
  expect(hosts[0]?.dataset.line).toBeUndefined()
  expect(hosts[1]?.dataset.line).toBe("240")
  expect(note).toContain("unknown")
})

it("refuses a source line when two paragraphs share the text", () => {
  const root = document.createElement("div")
  root.innerHTML = `<section class="docx"><article>
    <p>April 30, 2023</p><p>April 30, 2023</p>
  </article></section>`
  const note = paintSourceLines(
    root,
    documentXml(paragraph("April 30, 2023")),
    styles("240")
  )
  const hosts = [...root.querySelectorAll("article p")]
  expect(hosts[0]?.dataset.line).toBeUndefined()
  expect(hosts[1]?.dataset.line).toBeUndefined()
  expect(note).toContain("unknown")
})

it("reads the document and styles from one sample", async () => {
  const encoder = new TextEncoder()
  const bytes = zip(
    {
      "word/document.xml": encoder.encode(documentXml(paragraph("Hello"))),
      "word/styles.xml": encoder.encode(styles("264")),
    },
    0
  )
  const parts = await readDocxParts(bytes.buffer)
  expect(parts.documentXml).toContain("Hello")
  expect(sourceLineNote(parts.documentXml, parts.stylesXml)).toContain("264")
})
