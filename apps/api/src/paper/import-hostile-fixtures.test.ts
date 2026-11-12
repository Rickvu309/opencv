import { once } from "node:events"
import { createDeflate, deflateSync } from "node:zlib"

import { crc32 } from "./package-zip.js"

export function pdfFrom(objects: Array<string | Buffer>): Buffer {
  const parts: Buffer[] = [Buffer.from("%PDF-1.4\n")]
  let size = parts[0]!.length
  const offsets: number[] = []
  objects.forEach((object, index) => {
    offsets.push(size)
    const body = Buffer.concat([
      Buffer.from(`${index + 1} 0 obj\n`),
      typeof object === "string" ? Buffer.from(object, "latin1") : object,
      Buffer.from("\nendobj\n"),
    ])
    parts.push(body)
    size += body.length
  })
  let table = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  for (const offset of offsets)
    table += `${String(offset).padStart(10, "0")} 00000 n \n`
  parts.push(
    Buffer.from(
      `${table}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${size}\n%%EOF\n`
    )
  )
  return Buffer.concat(parts)
}

function flateStream(compressed: Buffer) {
  return Buffer.concat([
    Buffer.from(
      `<< /Length ${compressed.length} /Filter /FlateDecode >>\nstream\n`
    ),
    compressed,
    Buffer.from("\nendstream"),
  ])
}

export function onePagePdf(input: {
  content: Buffer
  declaredPages?: number
  catalogExtra?: string
}) {
  return pdfFrom([
    `<< /Type /Catalog /Pages 2 0 R ${input.catalogExtra ?? ""} >>`,
    `<< /Type /Pages /Count ${input.declaredPages ?? 1} /Kids [3 0 R] >>`,
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    flateStream(input.content),
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ])
}

export async function deflatedRepeat(unit: string, totalBytes: number) {
  const deflate = createDeflate({ level: 9 })
  const out: Buffer[] = []
  deflate.on("data", (chunk: Buffer) => out.push(chunk))
  const block = Buffer.from(unit.repeat(Math.ceil((1 << 20) / unit.length)))
  for (let written = 0; written < totalBytes; written += block.length) {
    if (!deflate.write(block)) await once(deflate, "drain")
  }
  deflate.end()
  await once(deflate, "end")
  return Buffer.concat(out)
}

export async function inflateBombPdf(inflatedBytes: number) {
  return onePagePdf({
    content: await deflatedRepeat("(a b) Tj ", inflatedBytes),
  })
}

export async function hexWrappedBombPdf(inflatedBytes: number) {
  const hex = Buffer.from(
    `${(await deflatedRepeat("(a b) Tj ", inflatedBytes)).toString("hex")}>`
  )
  return pdfFrom([
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Count 1 /Kids [3 0 R] >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    Buffer.concat([
      Buffer.from(
        `<< /Length ${hex.length} /Filter [/ASCIIHexDecode /FlateDecode] >>\nstream\n`
      ),
      hex,
      Buffer.from("\nendstream"),
    ]),
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ])
}

export function manyItemsPdf(items: number) {
  const body = `BT /F1 1 Tf ${"(a) Tj 0 -1 Td\n".repeat(items)}ET\n`
  return onePagePdf({ content: deflateSync(Buffer.from(body)) })
}

export function declaredPagesPdf(pages: number) {
  return onePagePdf({
    content: deflateSync(Buffer.from("BT /F1 12 Tf 72 720 Td (Hi) Tj ET\n")),
    declaredPages: pages,
  })
}

export function nestedPdf(depth: number) {
  return onePagePdf({
    content: deflateSync(Buffer.from("BT /F1 12 Tf 72 720 Td (Hi) Tj ET\n")),
    catalogExtra: `/Deep ${"[".repeat(depth)}${"]".repeat(depth)}`,
  })
}

type ZipMember = {
  name: string
  compressed: Buffer
  size: number
  crc: number
}

function header(size: number, write: (buffer: Buffer) => void) {
  const buffer = Buffer.alloc(size)
  write(buffer)
  return buffer
}

export function deflatedZip(members: ZipMember[]) {
  const locals: Buffer[] = []
  const centrals: Buffer[] = []
  let offset = 0
  for (const member of members) {
    const name = Buffer.from(member.name)
    const local = header(30, (buffer) => {
      buffer.writeUInt32LE(0x04034b50, 0)
      buffer.writeUInt16LE(20, 4)
      buffer.writeUInt16LE(8, 8)
      buffer.writeUInt32LE(member.crc, 14)
      buffer.writeUInt32LE(member.compressed.length, 18)
      buffer.writeUInt32LE(member.size, 22)
      buffer.writeUInt16LE(name.length, 26)
    })
    centrals.push(
      header(46, (buffer) => {
        buffer.writeUInt32LE(0x02014b50, 0)
        buffer.writeUInt16LE(20, 4)
        buffer.writeUInt16LE(20, 6)
        buffer.writeUInt16LE(8, 10)
        buffer.writeUInt32LE(member.crc, 16)
        buffer.writeUInt32LE(member.compressed.length, 20)
        buffer.writeUInt32LE(member.size, 24)
        buffer.writeUInt16LE(name.length, 28)
        buffer.writeUInt32LE(offset, 42)
      }),
      name
    )
    locals.push(local, name, member.compressed)
    offset += local.length + name.length + member.compressed.length
  }
  const central = Buffer.concat(centrals)
  const end = header(22, (buffer) => {
    buffer.writeUInt32LE(0x06054b50, 0)
    buffer.writeUInt16LE(members.length, 8)
    buffer.writeUInt16LE(members.length, 10)
    buffer.writeUInt32LE(central.length, 12)
    buffer.writeUInt32LE(offset, 16)
  })
  return Buffer.concat([...locals, central, end])
}

export function deflatedMember(name: string, data: Buffer): ZipMember {
  return {
    name,
    compressed: deflateSync(data).subarray(2, -4),
    size: data.length,
    crc: crc32(data),
  }
}

export async function wordBombDocx(
  inflatedBytes: number,
  declaredSize: number
) {
  const wrapped = await deflatedRepeat("A", inflatedBytes)
  return deflatedZip([
    deflatedMember("[Content_Types].xml", Buffer.from("<Types/>")),
    {
      name: "word/document.xml",
      compressed: wrapped.subarray(2, -4),
      size: declaredSize,
      crc: 0,
    },
  ])
}

export function manyEntriesDocx(entries: number) {
  return deflatedZip(
    Array.from({ length: entries }, (_, index) =>
      deflatedMember(`word/part-${index}.xml`, Buffer.from("<a/>"))
    )
  )
}

const runner = (
  import.meta as ImportMeta & { vitest?: typeof import("vitest") }
).vitest

if (runner) {
  const { describe, expect, it } = runner
  describe("hostile import fixtures", () => {
    it("builds a small PDF and a zip", () => {
      expect(declaredPagesPdf(2).subarray(0, 5).toString()).toBe("%PDF-")
      expect(manyEntriesDocx(2).readUInt32LE(0)).toBe(0x04034b50)
    })
  })
}

export function plainStream(dictionary: string, data: Buffer) {
  return Buffer.concat([
    Buffer.from(`<< ${dictionary} /Length ${data.length} >>\nstream\n`),
    data,
    Buffer.from("\nendstream"),
  ])
}

export function fanOutPdf() {
  const resources =
    "/Resources << /Font << /F1 5 0 R >> /XObject << /X1 6 0 R /X2 7 0 R >> >>"
  const inner = deflateSync(
    Buffer.from(`${"q Q ".repeat(25_000)}BT /F1 1 Tf (a) Tj ET`)
  )
  return pdfFrom([
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Count 1 /Kids [3 0 R] >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> /XObject << /X1 6 0 R /X2 7 0 R >> >> >>",
    plainStream("", Buffer.from("/X1 Do ".repeat(20))),
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    plainStream(
      `/Type /XObject /Subtype /Form /BBox [0 0 10 10] ${resources}`,
      Buffer.from("/X2 Do ".repeat(1000))
    ),
    plainStream(
      `/Type /XObject /Subtype /Form /BBox [0 0 10 10] /Filter /FlateDecode ${resources}`,
      inner
    ),
  ])
}
