import { inflateRawSync } from "node:zlib"

function readZipEntry(bytes, wanted) {
  const buffer = Buffer.from(bytes)
  let end = buffer.length - 22
  while (end >= 0 && buffer.readUInt32LE(end) !== 0x06054b50) end -= 1
  if (end < 0) throw new Error("not a zip file")
  const count = buffer.readUInt16LE(end + 10)
  let at = buffer.readUInt32LE(end + 16)
  for (let index = 0; index < count; index += 1) {
    if (buffer.readUInt32LE(at) !== 0x02014b50)
      throw new Error("broken zip directory")
    const method = buffer.readUInt16LE(at + 10)
    const size = buffer.readUInt32LE(at + 20)
    const nameLength = buffer.readUInt16LE(at + 28)
    const extraLength = buffer.readUInt16LE(at + 30)
    const noteLength = buffer.readUInt16LE(at + 32)
    const local = buffer.readUInt32LE(at + 42)
    const name = buffer.toString("utf8", at + 46, at + 46 + nameLength)
    if (name === wanted) {
      const start =
        local +
        30 +
        buffer.readUInt16LE(local + 26) +
        buffer.readUInt16LE(local + 28)
      const stored = buffer.subarray(start, start + size)
      return method === 0 ? stored : inflateRawSync(stored)
    }
    at += 46 + nameLength + extraLength + noteLength
  }
  throw new Error(`no ${wanted} in the file`)
}

function xmlText(value) {
  return value
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'")
    .replaceAll("&amp;", "&")
}

export function wordParagraphs(bytes) {
  const xml = readZipEntry(bytes, "word/document.xml").toString("utf8")
  if (!xml.includes("<w:body")) throw new Error("word/document.xml has no body")
  return (xml.match(/<w:p[ >][\s\S]*?<\/w:p>/g) ?? [])
    .map((paragraph) =>
      [...paragraph.matchAll(/<w:t(?: [^>]*)?>([^<]*)<\/w:t>/g)]
        .map((match) => xmlText(match[1]))
        .join("")
        .trim()
    )
    .filter(Boolean)
}
