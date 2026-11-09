import { readFileSync } from "node:fs"
import path from "node:path"
import { deflateRawSync } from "node:zlib"
import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"

import { WordPagePreview } from "./preview.tsx"
import { type LineMeasure } from "./short-advance.ts"

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

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

function sampleDocx() {
  const encoder = new TextEncoder()
  const files: Record<string, string> = {
    "[Content_Types].xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`,
    "_rels/.rels": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`,
    "word/_rels/document.xml.rels": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`,
    "word/styles.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/></w:rPr></w:rPrDefault>
  <w:pPrDefault><w:pPr><w:spacing w:line="264" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>
</w:styles>`,
    "word/document.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/></w:rPr><w:t>Hello pages</w:t></w:r></w:p>
    <w:sectPr><w:pgSz w:w="12240" w:h="15840"/></w:sectPr>
  </w:body>
</w:document>`,
  }
  const locals: Uint8Array[] = []
  const centrals: Uint8Array[] = []
  let offset = 0
  for (const [name, text] of Object.entries(files)) {
    const raw = encoder.encode(text)
    const data = deflateRawSync(raw)
    const nameBytes = encoder.encode(name)
    const crc = crc32(raw)
    const local = new Uint8Array(30 + nameBytes.length + data.length)
    const view = new DataView(local.buffer)
    view.setUint32(0, 0x04034b50, true)
    view.setUint16(4, 20, true)
    view.setUint16(8, 8, true)
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
    centralView.setUint16(10, 8, true)
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
  const out = new Uint8Array(offset + centralSize + end.length)
  let cursor = 0
  for (const part of [...locals, ...centrals, end]) {
    out.set(part, cursor)
    cursor += part.length
  }
  return out.buffer
}

const shortGap: LineMeasure = {
  text: "Leadership & Activities",
  nextText: "Organization",
  page: 1,
  nextPage: 1,
  section: "0",
  nextSection: "0",
  columnBreak: false,
  advancePx: 17.6,
  runSizePx: 18.7,
  sourceLine: 264,
}

it("stays off the current editor", () => {
  const route = readFileSync(
    path.join(process.cwd(), "src/routes/paper-doc.tsx"),
    "utf8"
  )
  const editor = readFileSync(
    path.join(process.cwd(), "src/features/paper/paper-editor-engine.tsx"),
    "utf8"
  )
  expect(route).not.toContain("paper-page/preview")
  expect(editor).not.toContain("docx-preview")
  expect(editor).toContain("BlockNoteViewRaw")
})

it("draws the sample pages and names the replaced font and the short gap", async () => {
  render(<WordPagePreview bytes={sampleDocx()} advances={[shortGap]} />)
  expect(await screen.findByLabelText("Word pages")).toBeVisible()
  expect(
    await screen.findByText(/Calibri is shown using Carlito/)
  ).toBeVisible()
  expect(
    screen.getByText(/Line spacing 264 \(1\.10\) advances 17\.6px/)
  ).toBeVisible()
  expect(screen.getByText(/Hello pages/)).toBeVisible()
  expect(screen.queryByText("Fonts substituted")).not.toBeInTheDocument()
})
