const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"

export type DocxParts = {
  documentXml: string
  stylesXml: string | null
  relsXml: string | null
  headers: Record<string, string>
  xml: string[]
}

export function xmlDoc(source: string) {
  return new DOMParser().parseFromString(source, "application/xml")
}

export function byLocal(root: ParentNode, name: string) {
  return [...root.querySelectorAll("*")].filter(
    (node) => node.localName === name
  )
}

export function attr(node: Element | null | undefined, local: string) {
  if (!node) return ""
  return (
    node.getAttributeNS(W, local) ||
    node.getAttributeNS(
      "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
      local
    ) ||
    node.getAttribute(`w:${local}`) ||
    node.getAttribute(`r:${local}`) ||
    node.getAttribute(local) ||
    ""
  )
}

function u32(bytes: Uint8Array, offset: number) {
  return (
    (bytes[offset]! |
      (bytes[offset + 1]! << 8) |
      (bytes[offset + 2]! << 16) |
      (bytes[offset + 3]! << 24)) >>>
    0
  )
}

function u16(bytes: Uint8Array, offset: number) {
  return bytes[offset]! | (bytes[offset + 1]! << 8)
}

function findEocd(bytes: Uint8Array) {
  const min = Math.max(0, bytes.length - 22 - 65535)
  for (let i = bytes.length - 22; i >= min; i--) {
    if (
      bytes[i] === 0x50 &&
      bytes[i + 1] === 0x4b &&
      bytes[i + 2] === 0x05 &&
      bytes[i + 3] === 0x06
    ) {
      return i
    }
  }
  return -1
}

async function inflate(data: Uint8Array) {
  const decompression = new DecompressionStream("deflate-raw")
  const writer = decompression.writable.getWriter()
  await writer.write(new Uint8Array(data))
  await writer.close()
  return new Uint8Array(
    await new Response(decompression.readable).arrayBuffer()
  )
}

export async function readZip(bytes: Uint8Array) {
  const eocd = findEocd(bytes)
  if (eocd < 0) throw new Error("Not a Word file")
  const count = u16(bytes, eocd + 10)
  let cursor = u32(bytes, eocd + 16)
  const files = new Map<string, Uint8Array>()
  for (let i = 0; i < count; i++) {
    if (u32(bytes, cursor) !== 0x02014b50) throw new Error("Not a Word file")
    const method = u16(bytes, cursor + 10)
    const compressed = u32(bytes, cursor + 20)
    const nameLength = u16(bytes, cursor + 28)
    const extraLength = u16(bytes, cursor + 30)
    const commentLength = u16(bytes, cursor + 32)
    const name = new TextDecoder().decode(
      bytes.subarray(cursor + 46, cursor + 46 + nameLength)
    )
    const local = u32(bytes, cursor + 42)
    const localName = u16(bytes, local + 26)
    const localExtra = u16(bytes, local + 28)
    const start = local + 30 + localName + localExtra
    const payload = bytes.subarray(start, start + compressed)
    files.set(name, method === 0 ? payload : await inflate(payload))
    cursor += 46 + nameLength + extraLength + commentLength
  }
  return files
}

function text(bytes: Uint8Array | undefined) {
  return bytes ? new TextDecoder().decode(bytes) : null
}

export async function readDocxParts(bytes: ArrayBuffer): Promise<DocxParts> {
  const files = await readZip(new Uint8Array(bytes))
  const documentXml = text(files.get("word/document.xml"))
  if (!documentXml) throw new Error("Not a Word file")
  const relsXml = text(files.get("word/_rels/document.xml.rels"))
  const headers: Record<string, string> = {}
  if (relsXml) {
    for (const rel of byLocal(xmlDoc(relsXml), "Relationship")) {
      const target = rel.getAttribute("Target") ?? ""
      if (!target.includes("header")) continue
      const path = target.startsWith("word/")
        ? target
        : `word/${target.replace(/^\//, "")}`
      const header = text(files.get(path))
      const id = rel.getAttribute("Id")
      if (header && id) headers[id] = header
    }
  }
  const xml = [...files.entries()]
    .filter(([name]) => name.startsWith("word/") && name.endsWith(".xml"))
    .map(([, value]) => new TextDecoder().decode(value))
  return {
    documentXml,
    stylesXml: text(files.get("word/styles.xml")),
    relsXml,
    headers,
    xml,
  }
}

function autoLine(spacing: Element | undefined) {
  if (!spacing) return ""
  if (attr(spacing, "lineRule") !== "auto") return ""
  return attr(spacing, "line")
}

export function paragraphLines(documentXml: string, stylesXml: string | null) {
  const document = xmlDoc(documentXml)
  const styles = stylesXml ? xmlDoc(stylesXml) : null
  const defaults = styles ? byLocal(styles, "pPrDefault")[0] : undefined
  const defaultLine = autoLine(
    defaults
      ? byLocal(defaults, "spacing").find((node) => autoLine(node))
      : undefined
  )
  const paragraphs = byLocal(document, "body").length
    ? [...(byLocal(document, "body")[0]?.children ?? [])].filter(
        (node) => node.localName === "p"
      )
    : []
  return paragraphs.map((paragraph) => {
    const own = byLocal(paragraph, "pPr")[0]
    const spacing = own
      ? byLocal(own, "spacing").find((node) => autoLine(node))
      : undefined
    const raw = autoLine(spacing)
    const line = raw || defaultLine || "240"
    return { paragraph, line, raw }
  })
}

export function sourceLineNote(documentXml: string, stylesXml: string | null) {
  const counts = new Map<string, number>()
  for (const row of paragraphLines(documentXml, stylesXml)) {
    counts.set(row.line, (counts.get(row.line) ?? 0) + 1)
  }
  const parts = [...counts.entries()].map(
    ([line, count]) =>
      `${line} (${(Number(line) / 240).toFixed(2)}) on ${count} paragraphs`
  )
  return parts.length ? `Line spacing is the source ${parts.join("; ")}.` : ""
}

function collapsed(value: string) {
  return value.replace(/\s+/g, "").slice(0, 24)
}

function sameParagraph(want: string, got: string) {
  if (!want || !got) return false
  if (want === got) return true
  if (want.length < 8 || got.length < 8) return false
  return got.startsWith(want.slice(0, 12)) || want.startsWith(got.slice(0, 12))
}

export function paragraphText(paragraph: Element) {
  return byLocal(paragraph, "t")
    .map((node) => node.textContent ?? "")
    .join("")
}

export function paintSourceLines(
  root: ParentNode,
  documentXml: string,
  stylesXml: string | null
) {
  const rows = paragraphLines(documentXml, stylesXml)
  const hosts = [
    ...root.querySelectorAll<HTMLParagraphElement>("article p"),
  ].filter((node) => !node.classList.contains("source-header"))
  const used = new Set<number>()
  let unknown = 0
  let section = 0
  let afterBreak = false
  for (const row of rows) {
    const want = collapsed(paragraphText(row.paragraph))
    const columnBreak = byLocal(row.paragraph, "br").some(
      (node) => attr(node, "type") === "column"
    )
    if (want) {
      const matches = hosts
        .map((host, index) => ({ host, index }))
        .filter(
          ({ host, index }) =>
            !used.has(index) &&
            sameParagraph(want, collapsed(host.textContent ?? ""))
        )
      const match = matches[0]
      if (matches.length !== 1 || !match) unknown += 1
      else {
        used.add(match.index)
        match.host.dataset.section = String(section)
        if (columnBreak || afterBreak) match.host.dataset.columnBreak = "1"
        match.host.dataset.line = row.line
        const wantLine = Number(row.line) / 240
        const style = getComputedStyle(match.host)
        const size = Number.parseFloat(style.fontSize)
        const drawn = Number.parseFloat(style.lineHeight)
        if (!size || !(drawn / size >= wantLine * 0.9)) {
          match.host.style.lineHeight = wantLine.toFixed(4)
        }
      }
    }
    if (columnBreak) afterBreak = true
    if (byLocal(row.paragraph, "sectPr")[0]) {
      section += 1
      afterBreak = false
    }
  }
  for (const [index, host] of hosts.entries()) {
    if (used.has(index)) continue
    if (!collapsed(host.textContent ?? "")) continue
    unknown += 1
  }
  const note = sourceLineNote(documentXml, stylesXml)
  return unknown
    ? `${note} Line spacing source map is unknown for ${unknown} paragraphs.`.trim()
    : note
}
