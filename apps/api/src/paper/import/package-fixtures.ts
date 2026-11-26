import { deflateRawSync } from "node:zlib"

const OFFICE_RELATIONSHIP_NS =
  "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
const RELATIONSHIP_NS =
  "http://schemas.openxmlformats.org/package/2006/relationships"
const CONTENT_TYPE_NS =
  "http://schemas.openxmlformats.org/package/2006/content-types"
import { WORD_NS } from "./package-xml.js"
import { crc32, readPackageZip } from "./package-zip.js"

export function fixtureZip(
  files: Record<string, string | Buffer>,
  method = 8,
  descriptor?: "signed" | "unsigned"
) {
  const locals: Buffer[] = []
  const central: Buffer[] = []
  let offset = 0
  for (const [name, content] of Object.entries(files)) {
    const bytes = Buffer.from(content)
    const label = Buffer.from(name)
    const compressed = method === 0 ? bytes : deflateRawSync(bytes)
    const local = Buffer.alloc(30 + label.length)
    local.writeUInt32LE(0x04034b50)
    local.writeUInt16LE(20, 4)
    local.writeUInt16LE(descriptor ? 0x808 : 0x800, 6)
    local.writeUInt16LE(method, 8)
    local.writeUInt32LE(crc32(bytes), 14)
    local.writeUInt32LE(compressed.length, 18)
    local.writeUInt32LE(bytes.length, 22)
    local.writeUInt16LE(label.length, 26)
    label.copy(local, 30)
    const record = Buffer.alloc(46 + label.length)
    record.writeUInt32LE(0x02014b50)
    record.writeUInt16LE(20, 4)
    record.writeUInt16LE(20, 6)
    record.writeUInt16LE(descriptor ? 0x808 : 0x800, 8)
    record.writeUInt16LE(method, 10)
    record.writeUInt32LE(crc32(bytes), 16)
    record.writeUInt32LE(compressed.length, 20)
    record.writeUInt32LE(bytes.length, 24)
    record.writeUInt16LE(label.length, 28)
    record.writeUInt32LE(offset, 42)
    label.copy(record, 46)
    const trailer = Buffer.alloc(
      descriptor ? (descriptor === "signed" ? 16 : 12) : 0
    )
    if (descriptor) {
      local.fill(0, 14, 26)
      const prefix = trailer.length - 12
      if (prefix) trailer.writeUInt32LE(0x08074b50)
      trailer.writeUInt32LE(crc32(bytes), prefix)
      trailer.writeUInt32LE(compressed.length, prefix + 4)
      trailer.writeUInt32LE(bytes.length, prefix + 8)
    }
    locals.push(local, compressed, trailer)
    central.push(record)
    offset += local.length + compressed.length + trailer.length
  }
  const footer = Buffer.alloc(22)
  footer.writeUInt32LE(0x06054b50)
  footer.writeUInt16LE(central.length, 8)
  footer.writeUInt16LE(central.length, 10)
  footer.writeUInt32LE(
    central.reduce((size, record) => size + record.length, 0),
    12
  )
  footer.writeUInt32LE(offset, 16)
  return Buffer.concat([...locals, ...central, footer])
}

export function run(text: string, properties = "") {
  const space =
    text.startsWith(" ") || text.endsWith(" ") ? ' xml:space="preserve"' : ""
  return `<w:r>${properties ? `<w:rPr>${properties}</w:rPr>` : ""}<w:t${space}>${text}</w:t></w:r>`
}

export function paragraph(text: string, properties = "") {
  return `<w:p>${properties ? `<w:pPr>${properties}</w:pPr>` : ""}${run(text)}</w:p>`
}

export function story(root: string, content: string) {
  return `<w:${root} xmlns:w="${WORD_NS}" xmlns:r="${OFFICE_RELATIONSHIP_NS}">${content}</w:${root}>`
}

export function relationship(
  id: string,
  kind: string,
  target: string,
  external = false
) {
  return `<Relationship Id="${id}" Type="${OFFICE_RELATIONSHIP_NS}/${kind}" Target="${target}"${external ? ' TargetMode="External"' : ""}/>`
}

export type FixtureOptions = {
  parts?: Record<string, string | Buffer>
  relationships?: string[]
}

export function fixtureFiles(body: string, extra: FixtureOptions = {}) {
  const additions = extra.parts ?? {}
  const relations = [
    relationship("styles", "styles", "styles.xml"),
    ...(extra.relationships ?? []),
  ]
  const overrides = [
    ["word/document.xml", "document.main"],
    ["word/styles.xml", "styles"],
  ]
  for (const name of Object.keys(additions)) {
    const match = /^word\/(comments|header[0-9]+|footer[0-9]+)\.xml$/.exec(name)
    if (!match) continue
    const kind = match[1].replace(/[0-9]+$/, "")
    relations.push(relationship(match[1], kind, name.slice(5)))
    overrides.push([name, kind])
  }
  const types = overrides
    .map(
      ([name, type]) =>
        `<Override PartName="/${name}" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.${type}+xml"/>`
    )
    .join("")
  const files: Record<string, string | Buffer> = {
    "[Content_Types].xml": `<Types xmlns="${CONTENT_TYPE_NS}"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>${types}</Types>`,
    "_rels/.rels": `<Relationships xmlns="${RELATIONSHIP_NS}">${relationship("main", "officeDocument", "word/document.xml")}</Relationships>`,
    "word/document.xml": `<w:document xmlns:w="${WORD_NS}" xmlns:r="${OFFICE_RELATIONSHIP_NS}" xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml"><w:body>${body}<w:sectPr/></w:body></w:document>`,
    "word/styles.xml": story(
      "styles",
      '<w:style w:type="paragraph" w:styleId="Normal"><w:name w:val="Normal"/></w:style><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/></w:style>'
    ),
    "word/_rels/document.xml.rels": `<Relationships xmlns="${RELATIONSHIP_NS}">${relations.join("")}</Relationships>`,
    ...additions,
  }
  return files
}

export function fixturePackage(body: string, options: FixtureOptions = {}) {
  return fixtureZip(fixtureFiles(body, options))
}

export function packageMember(
  archive: {
    entries: readonly { name: string; local: Buffer | Uint8Array }[]
    files: Map<string, Buffer>
  },
  name: string
): { local: Buffer | Uint8Array; bytes: Buffer } | undefined
export function packageMember(
  input: Uint8Array,
  name: string
): Promise<{ local: Buffer | Uint8Array; bytes: Buffer } | undefined>
export function packageMember(
  source:
    | Uint8Array
    | {
        entries: readonly { name: string; local: Buffer | Uint8Array }[]
        files: Map<string, Buffer>
      },
  name: string
):
  | { local: Buffer | Uint8Array; bytes: Buffer }
  | undefined
  | Promise<{ local: Buffer | Uint8Array; bytes: Buffer } | undefined> {
  if ("files" in source) {
    const entry = source.entries.find((item) => item.name === name)
    const bytes = source.files.get(name)
    if (!entry || !bytes) return undefined
    return { local: entry.local, bytes }
  }
  return readPackageZip(source).then((archive) => {
    const entry = archive.entries.find((item) => item.name === name)
    const bytes = archive.files.get(name)
    if (!entry || !bytes) return undefined
    return { local: entry.local, bytes }
  })
}
