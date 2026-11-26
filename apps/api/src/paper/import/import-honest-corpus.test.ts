import { randomUUID } from "node:crypto"
import { deflateSync } from "node:zlib"

import { describe, expect, it } from "vitest"

import { columnLines, linedPdf } from "./import-fixtures.test.js"
import {
  deflatedRepeat,
  pdfFrom,
  plainStream,
} from "./import-hostile-fixtures.test.js"
import { IMPORT_READ_LIMITS } from "./import-limits.js"
import {
  IMPORT_PDF_HEAVY_MESSAGE,
  IMPORT_SCANNED_MESSAGE,
  importParsers,
} from "./import-parse.js"
import { pdfStreamsFit } from "./import-text-worker.js"
import { PDF_IMPORT_NOTICE, importedPaper } from "./import-word.js"

const A4_300_DPI = { width: 2480, height: 3508 }

function scannedBackground() {
  const { width, height } = A4_300_DPI
  const row = Buffer.alloc(width * 3)
  for (let x = 0; x < width; x += 1) {
    row[x * 3] = 240
    row[x * 3 + 1] = 244 - (x % 7)
    row[x * 3 + 2] = 250
  }
  const raw = Buffer.alloc(width * height * 3)
  for (let y = 0; y < height; y += 1) row.copy(raw, y * width * 3)
  return deflateSync(raw, { level: 6 })
}

function imageStream(image: Buffer) {
  const { width, height } = A4_300_DPI
  return plainStream(
    `/Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode`,
    image
  )
}

const FONT = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"

function designedPdf(pages: Array<string | null>, extra: Buffer[] = []) {
  const image = scannedBackground()
  const objects: Array<string | Buffer> = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "",
    FONT,
  ]
  const kids: string[] = []
  pages.forEach((text) => {
    const base = objects.length + 1
    kids.push(`${base} 0 R`)
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents ${base + 1} 0 R /Resources << /Font << /F1 3 0 R >> /XObject << /Im1 ${base + 2} 0 R >> >> >>`
    )
    const words = text
      ? `BT /F1 12 Tf 72 760 Td (${text}) Tj 0 -16 Td (EXPERIENCE) Tj 0 -16 Td (Analyst at Example Co) Tj ET`
      : ""
    objects.push(
      plainStream("", Buffer.from(`q 595 0 0 842 0 0 cm /Im1 Do Q ${words}`))
    )
    objects.push(imageStream(image))
  })
  objects[1] = `<< /Type /Pages /Count ${pages.length} /Kids [${kids.join(" ")}] >>`
  objects.push(...extra)
  return pdfFrom(objects)
}

const STANDARD_FONTS = [
  "Helvetica",
  "Helvetica-Bold",
  "Helvetica-Oblique",
  "Helvetica-BoldOblique",
  "Times-Roman",
  "Times-Bold",
  "Times-Italic",
  "Times-BoldItalic",
  "Courier",
  "Courier-Bold",
  "Courier-Oblique",
  "Courier-BoldOblique",
  "Symbol",
  "ZapfDingbats",
]

function manyFontsPdf() {
  const fonts = STANDARD_FONTS.map(
    (name, index) => `/F${index + 1} ${index + 5} 0 R`
  ).join(" ")
  const lines = STANDARD_FONTS.slice(0, 12)
    .map(
      (_, index) =>
        `BT /F${index + 1} 11 Tf 72 ${760 - index * 16} Td (Line ${index + 1} in font ${index + 1}) Tj ET`
    )
    .join("\n")
  return pdfFrom([
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Count 1 /Kids [3 0 R] >>",
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << ${fonts} >> >> >>`,
    plainStream("", Buffer.from(lines)),
    ...STANDARD_FONTS.map(
      (name) => `<< /Type /Font /Subtype /Type1 /BaseFont /${name} >>`
    ),
  ])
}

async function embeddedFontPdf(fontBytes: number) {
  const program = await deflatedRepeat("\u0000", fontBytes)
  return pdfFrom([
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Count 1 /Kids [3 0 R] >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 7 0 R >> >> >>",
    plainStream(
      "",
      Buffer.from(
        "BT /F1 12 Tf 72 760 Td (Minh Anh) Tj 0 -16 Td (Analyst at Example Co) Tj ET"
      )
    ),
    "<< /Type /Font /Subtype /TrueType /BaseFont /NotoSansCJK /FirstChar 32 /LastChar 126 /Encoding /WinAnsiEncoding /FontDescriptor 6 0 R >>",
    "<< /Type /FontDescriptor /FontName /NotoSansCJK /Flags 32 /FontBBox [0 0 1000 1000] /ItalicAngle 0 /Ascent 900 /Descent -100 /CapHeight 700 /StemV 80 /FontFile2 8 0 R >>",
    FONT,
    plainStream(`/Length1 ${fontBytes} /Filter /FlateDecode`, program),
  ])
}

async function attachedFilesPdf() {
  const attachment = await deflatedRepeat("portfolio ", 40 * 2 ** 20)
  const metadata = await deflatedRepeat("<rdf:li>x</rdf:li>", 8 * 2 ** 20)
  return pdfFrom([
    "<< /Type /Catalog /Pages 2 0 R /Metadata 6 0 R /Names << /EmbeddedFiles << /Names [(portfolio.txt) 7 0 R] >> >> >>",
    "<< /Type /Pages /Count 1 /Kids [3 0 R] >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    plainStream(
      "",
      Buffer.from("BT /F1 12 Tf 72 760 Td (Minh Anh portfolio) Tj ET")
    ),
    FONT,
    plainStream("/Type /Metadata /Subtype /XML /Filter /FlateDecode", metadata),
    "<< /Type /Filespec /F (portfolio.txt) /EF << /F 8 0 R >> >>",
    plainStream("/Type /EmbeddedFile /Filter /FlateDecode", attachment),
  ])
}

async function read(bytes: Buffer) {
  const owner = randomUUID()
  const text = await importParsers.pdfText(bytes, true, { owner })
  const page = await importedPaper(
    { name: "cv.pdf", mediaType: "application/pdf", bytes },
    { owner: randomUUID() }
  )
  return { text, page }
}

async function refusal(bytes: Buffer) {
  return importedPaper(
    { name: "cv.pdf", mediaType: "application/pdf", bytes },
    { owner: randomUUID() }
  ).then(
    () => "imported",
    (error: Error) => error.message
  )
}

describe("honest PDFs import", () => {
  it("imports a 2-page CV of 146 KB with 300-dpi Flate page backgrounds", async () => {
    const bytes = designedPdf(["Minh Anh page 1", "Minh Anh page 2"])
    expect(bytes.length).toBeLessThan(200_000)
    const { text, page } = await read(bytes)
    expect(text).toContain("Minh Anh page 2")
    expect(page.notice).toBe(PDF_IMPORT_NOTICE)
  }, 30_000)

  it("imports 15 pages of text, each over a full-page Flate image", async () => {
    const pages = Array.from(
      { length: 15 },
      (_, index) => `Minh Anh page ${index + 1}`
    )
    const { text } = await read(designedPdf(pages))
    expect(text).toContain("Minh Anh page 15")
  }, 60_000)

  it("imports 15 pages of 45 lines each", async () => {
    const bytes = linedPdf(
      Array.from({ length: 15 }, (_, page) =>
        columnLines(
          Array.from(
            { length: 45 },
            (_, line) => `Page ${page + 1} line ${line + 1} Analyst`
          ),
          72,
          780
        )
      )
    )
    const { text } = await read(bytes)
    expect(text).toContain("Page 15 line 45 Analyst")
  }, 30_000)

  it("imports a CV set in many fonts", async () => {
    const { text } = await read(manyFontsPdf())
    expect(text).toContain("Line 12 in font 12")
  }, 30_000)

  it("imports a CV that embeds a 24 MB font program", async () => {
    const { text } = await read(await embeddedFontPdf(24 * 2 ** 20))
    expect(text).toContain("Analyst at Example Co")
  }, 30_000)

  it("imports a CV carrying a 40 MB attached file and 8 MB of metadata", async () => {
    const { text } = await read(await attachedFilesPdf())
    expect(text).toContain("Minh Anh portfolio")
  }, 30_000)

  it("imports Vietnamese, Chinese and Arabic text, with Arabic drawn in visual order as PDF writers do", async () => {
    const arabic = "محللة بيانات في شركة مثال"
    const lines = [
      "Nguyễn Thị Minh Anh",
      "Kinh nghiệm: Chuyên viên phân tích",
      "陈明安 数据分析师",
    ]
    const drawn = [...lines, [...arabic].reverse().join("")]
    const { text } = await read(linedPdf([columnLines(drawn)]))
    for (const line of [...lines, arabic]) expect(text).toContain(line)
  }, 30_000)

  it("tells a person a scanned page has no text, not that it is too large", async () => {
    expect(await refusal(designedPdf([null]))).toBe(IMPORT_SCANNED_MESSAGE)
  }, 30_000)
})

describe("the stream scan counts only what the text reader decodes", () => {
  it("skips images, attached files, metadata and font programs, and still counts content", async () => {
    const big = await deflatedRepeat(
      "(a b) Tj ",
      IMPORT_READ_LIMITS.inflatedBytes + 1024
    )
    const limits = IMPORT_READ_LIMITS
    const one = (dictionary: string) =>
      pdfFrom([plainStream(`${dictionary} /Filter /FlateDecode`, big)])
    expect(pdfStreamsFit(one("/Type /XObject /Subtype /Image"), limits)).toBe(
      true
    )
    expect(pdfStreamsFit(one("/Type /EmbeddedFile"), limits)).toBe(true)
    expect(pdfStreamsFit(one("/Type /Metadata /Subtype /XML"), limits)).toBe(
      true
    )
    expect(pdfStreamsFit(one("/Length1 9"), limits)).toBe(true)
    expect(pdfStreamsFit(one("/Subtype /OpenType"), limits)).toBe(true)
    expect(pdfStreamsFit(one(""), limits)).toBe(false)
    expect(pdfStreamsFit(one("/Type /XObject /Subtype /Form"), limits)).toBe(
      false
    )
  })

  it("stops a content bomb labelled as an image with the worker's memory watch or deadline", async () => {
    const bomb = await deflatedRepeat("(a b) Tj ", 256 * 2 ** 20)
    const bytes = pdfFrom([
      "<< /Type /Catalog /Pages 2 0 R >>",
      "<< /Type /Pages /Count 1 /Kids [3 0 R] >>",
      "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
      plainStream("/Subtype /Image /Filter /FlateDecode", bomb),
      FONT,
    ])
    const start = performance.now()
    expect(await refusal(bytes)).toBe(IMPORT_PDF_HEAVY_MESSAGE)
    expect(performance.now() - start).toBeLessThan(
      importParsers.timeoutMs + 2_000
    )
  }, 30_000)
})
