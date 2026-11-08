import { inflateRawSync } from "node:zlib"
import { DOMParser } from "@xmldom/xmldom/lib/dom-parser.js"

export function witnessArchive(bytes: Buffer) {
  const files = new Map<string, { local: Buffer; bytes: Buffer }>()
  let footer = bytes.length - 22
  while (
    footer >= 0 &&
    (bytes.readUInt32LE(footer) !== 0x06054b50 ||
      footer + 22 + bytes.readUInt16LE(footer + 20) !== bytes.length)
  )
    footer--
  if (footer < 0) throw new Error("Missing ZIP footer")
  const directory = bytes.readUInt32LE(footer + 16)
  const entries: {
    name: string
    offset: number
    size: number
    method: number
  }[] = []
  let at = directory
  for (let index = 0; index < bytes.readUInt16LE(footer + 10); index++) {
    if (bytes.readUInt32LE(at) !== 0x02014b50)
      throw new Error("Invalid witness ZIP directory")
    entries.push({
      name: bytes.toString(
        "utf8",
        at + 46,
        at + 46 + bytes.readUInt16LE(at + 28)
      ),
      offset: bytes.readUInt32LE(at + 42),
      size: bytes.readUInt32LE(at + 20),
      method: bytes.readUInt16LE(at + 10),
    })
    at +=
      46 +
      bytes.readUInt16LE(at + 28) +
      bytes.readUInt16LE(at + 30) +
      bytes.readUInt16LE(at + 32)
  }
  entries.sort((left, right) => left.offset - right.offset)
  for (const [index, entry] of entries.entries()) {
    const dataAt =
      entry.offset +
      30 +
      bytes.readUInt16LE(entry.offset + 26) +
      bytes.readUInt16LE(entry.offset + 28)
    const name = entry.name
    const compressed = bytes.subarray(dataAt, dataAt + entry.size)
    const content =
      entry.method === 0 ? Buffer.from(compressed) : inflateRawSync(compressed)
    if (name.endsWith(".xml") || name.endsWith(".rels")) {
      const reject = (message: string) => {
        throw new Error(message)
      }
      new DOMParser({
        errorHandler: { warning: reject, error: reject, fatalError: reject },
      }).parseFromString(content.toString("utf8"), "application/xml")
    }
    files.set(name, {
      local: Buffer.from(
        bytes.subarray(entry.offset, entries[index + 1]?.offset ?? directory)
      ),
      bytes: content,
    })
  }
  return files
}
