/** Test-only PDF and DOCX builders. Production modules do not import this file. */

export function textPdf(text: string): Buffer {
  const safe = text.replace(/[()\\]/g, " ")
  const stream = `BT /F1 24 Tf 72 720 Td (${safe}) Tj ET\n`
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Count 1 /Kids [3 0 R] >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}endstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ]
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

export function textDocx(paragraph: string) {
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
  return zipStore([
    { name: "[Content_Types].xml", data: Buffer.from(types) },
    { name: "_rels/.rels", data: Buffer.from(rels) },
    { name: "word/document.xml", data: Buffer.from(document) },
  ])
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
