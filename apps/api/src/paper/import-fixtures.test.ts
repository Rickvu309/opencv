function pdfDocument(objects: string[]): Buffer {
  let body = "%PDF-1.4\n"
  const offsets = [0]
  for (let index = 0; index < objects.length; index += 1) {
    offsets.push(Buffer.byteLength(body))
    body += `${index + 1} 0 obj\n${objects[index]}\nendobj\n`
  }
  const xref = Buffer.byteLength(body)
  let table = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  for (let index = 1; index < offsets.length; index += 1) {
    table += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`
  }
  body += `${table}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return Buffer.from(body, "utf8")
}

export function textPdf(text: string): Buffer {
  return pagedPdf([text])
}

export function pagedPdf(pages: string[]): Buffer {
  const count = Math.max(pages.length, 1)
  const fontId = 3 + count * 2
  const kids: string[] = []
  const objects = ["<< /Type /Catalog /Pages 2 0 R >>", ""]
  for (let index = 0; index < count; index += 1) {
    const pageId = 3 + index * 2
    const contentId = pageId + 1
    kids.push(`${pageId} 0 R`)
    const safe = (pages[index] ?? "").replace(/[()\\]/g, " ")
    const stream = safe ? `BT /F1 24 Tf 72 720 Td (${safe}) Tj ET\n` : ""
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents ${contentId} 0 R /Resources << /Font << /F1 ${fontId} 0 R >> >> >>`
    )
    objects.push(
      `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}endstream`
    )
  }
  objects[1] = `<< /Type /Pages /Count ${count} /Kids [${kids.join(" ")}] >>`
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")
  return pdfDocument(objects)
}

export type PdfLine = { x: number; y: number; text: string }

function hex4(value: number) {
  return value.toString(16).padStart(4, "0").toUpperCase()
}

function unicodeHex(char: string) {
  let out = ""
  for (let index = 0; index < char.length; index += 1)
    out += hex4(char.charCodeAt(index))
  return out
}

export function linedPdf(pages: PdfLine[][]): Buffer {
  const chars = [...new Set(pages.flat().flatMap((line) => [...line.text]))]
  const cid = new Map(chars.map((char, index) => [char, index + 1]))
  const count = Math.max(pages.length, 1)
  const fontId = 3 + count * 2
  const objects = ["<< /Type /Catalog /Pages 2 0 R >>", ""]
  const kids: string[] = []
  for (let index = 0; index < count; index += 1) {
    const pageId = 3 + index * 2
    kids.push(`${pageId} 0 R`)
    const stream = (pages[index] ?? [])
      .map(
        (line) =>
          `BT /F1 11 Tf ${line.x} ${line.y} Td <${[...line.text]
            .map((char) => hex4(cid.get(char)!))
            .join("")}> Tj ET\n`
      )
      .join("")
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents ${pageId + 1} 0 R /Resources << /Font << /F1 ${fontId} 0 R >> >> >>`
    )
    objects.push(
      `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}endstream`
    )
  }
  objects[1] = `<< /Type /Pages /Count ${count} /Kids [${kids.join(" ")}] >>`
  const blocks: string[] = []
  for (let start = 0; start < chars.length; start += 100) {
    const slice = chars.slice(start, start + 100)
    blocks.push(
      `${slice.length} beginbfchar\n${slice
        .map((char) => `<${hex4(cid.get(char)!)}> <${unicodeHex(char)}>`)
        .join("\n")}\nendbfchar`
    )
  }
  const cmap = `/CIDInit /ProcSet findresource begin\n12 dict begin\nbegincmap\n/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def\n/CMapName /Adobe-Identity-UCS def\n/CMapType 2 def\n1 begincodespacerange\n<0000> <FFFF>\nendcodespacerange\n${blocks.join("\n")}\nendcmap\nCMapName currentdict /CMap defineresource pop\nend\nend\n`
  objects.push(
    `<< /Type /Font /Subtype /Type0 /BaseFont /Helvetica /Encoding /Identity-H /DescendantFonts [${fontId + 1} 0 R] /ToUnicode ${fontId + 2} 0 R >>`
  )
  objects.push(
    "<< /Type /Font /Subtype /CIDFontType2 /BaseFont /Helvetica /CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >> /DW 500 >>"
  )
  objects.push(
    `<< /Length ${Buffer.byteLength(cmap)} >>\nstream\n${cmap}endstream`
  )
  return pdfDocument(objects)
}

export function columnLines(lines: string[], x = 72, top = 720) {
  return lines.map((text, index) => ({ x, y: top - index * 16, text }))
}

export function lockedPdf(): Buffer {
  const plain = pagedPdf(["Locked CV"]).toString("latin1")
  const fill = (char: string) => char.repeat(64)
  const objectCount = Number(/\/Size (\d+)/.exec(plain)![1])
  const encrypt = `${objectCount} 0 obj\n<< /Filter /Standard /V 1 /R 2 /O <${fill("A")}> /U <${fill("B")}> /P -44 >>\nendobj\n`
  const xrefAt = plain.indexOf("xref\n")
  const body = plain.slice(0, xrefAt) + encrypt
  const offsets: number[] = []
  const pattern = /(\d+) 0 obj\n/g
  for (const match of body.matchAll(pattern))
    offsets[Number(match[1])] = match.index!
  let table = `xref\n0 ${objectCount + 1}\n0000000000 65535 f \n`
  for (let index = 1; index <= objectCount; index += 1)
    table += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`
  const id = "0123456789ABCDEF0123456789ABCDEF"
  return Buffer.from(
    `${body}${table}trailer\n<< /Size ${objectCount + 1} /Root 1 0 R /Encrypt ${objectCount} 0 R /ID [<${id}> <${id}>] >>\nstartxref\n${Buffer.byteLength(body, "latin1")}\n%%EOF\n`,
    "latin1"
  )
}

function crc32(data: Buffer) {
  let crc = 0xffffffff
  for (const byte of data) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1
    }
  }
  return (crc ^ 0xffffffff) >>> 0
}

function uint16(value: number) {
  const buffer = Buffer.alloc(2)
  buffer.writeUInt16LE(value)
  return buffer
}

function uint32(value: number) {
  const buffer = Buffer.alloc(4)
  buffer.writeUInt32LE(value >>> 0)
  return buffer
}

function zipStore(entries: { name: string; data: Buffer }[]) {
  const parts: Buffer[] = []
  const central: Buffer[] = []
  let offset = 0
  for (const file of entries) {
    const name = Buffer.from(file.name)
    const crc = crc32(file.data)
    const local = Buffer.concat([
      uint32(0x04034b50),
      uint16(20),
      uint16(0),
      uint16(0),
      uint16(0),
      uint16(0),
      uint32(crc),
      uint32(file.data.length),
      uint32(file.data.length),
      uint16(name.length),
      uint16(0),
      name,
      file.data,
    ])
    parts.push(local)
    central.push(
      Buffer.concat([
        uint32(0x02014b50),
        uint16(20),
        uint16(20),
        uint16(0),
        uint16(0),
        uint16(0),
        uint16(0),
        uint32(crc),
        uint32(file.data.length),
        uint32(file.data.length),
        uint16(name.length),
        uint16(0),
        uint16(0),
        uint16(0),
        uint16(0),
        uint32(0),
        uint32(offset),
        name,
      ])
    )
    offset += local.length
  }
  const directory = Buffer.concat(central)
  const end = Buffer.concat([
    uint32(0x06054b50),
    uint16(0),
    uint16(0),
    uint16(entries.length),
    uint16(entries.length),
    uint32(directory.length),
    uint32(offset),
    uint16(0),
  ])
  return Buffer.concat([...parts, directory, end])
}

export function textDocx(paragraph: string, extraFiles = 0) {
  const safe = paragraph
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
  const document = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>${safe}</w:t></w:r></w:p></w:body></w:document>`
  const types = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`
  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`
  const entries = [
    { name: "[Content_Types].xml", data: Buffer.from(types) },
    { name: "_rels/.rels", data: Buffer.from(rels) },
    { name: "word/document.xml", data: Buffer.from(document) },
  ]
  for (let index = 0; index < extraFiles; index += 1) {
    entries.push({
      name: `word/extra-${index}.xml`,
      data: Buffer.from("<extra/>"),
    })
  }
  return zipStore(entries)
}

const runner = (
  import.meta as ImportMeta & { vitest?: typeof import("vitest") }
).vitest

if (runner) {
  const { describe, expect, it } = runner
  describe("import fixtures", () => {
    it("builds a text PDF and a docx", () => {
      expect(textPdf("Hi").subarray(0, 5).toString()).toBe("%PDF-")
      expect(textDocx("Hi").byteLength).toBeGreaterThan(100)
    })
  })
}
