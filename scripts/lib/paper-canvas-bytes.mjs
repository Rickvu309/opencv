import { randomUUID } from "node:crypto"
import { deflateRawSync, inflateRawSync } from "node:zlib"

const WORD = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
const REL =
  "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
const PKG = "http://schemas.openxmlformats.org/package/2006/relationships"
const TYPES = "http://schemas.openxmlformats.org/package/2006/content-types"
const W14 = "http://schemas.microsoft.com/office/word/2010/wordml"
const PPR = '<w:pStyle w:val="Normal"/><w:jc w:val="center"/>'
const RPR = '<w:color w:val="231F20"/>'
const SECT =
  '<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr>'

function crc32(bytes) {
  let value = 0xffffffff
  for (const byte of bytes) {
    value ^= byte
    for (let bit = 0; bit < 8; bit++)
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1
  }
  return (value ^ 0xffffffff) >>> 0
}

function readZip(input) {
  const bytes = Buffer.from(input)
  let end = -1
  for (
    let at = bytes.length - 22;
    at >= Math.max(0, bytes.length - 65557);
    at--
  ) {
    if (
      bytes.readUInt32LE(at) === 0x06054b50 &&
      at + 22 + bytes.readUInt16LE(at + 20) === bytes.length
    ) {
      end = at
      break
    }
  }
  if (end < 0) throw new Error("invalid zip")
  const count = bytes.readUInt16LE(end + 10)
  let at = bytes.readUInt32LE(end + 16)
  const files = []
  for (let index = 0; index < count; index++) {
    if (bytes.readUInt32LE(at) !== 0x02014b50) throw new Error("invalid zip")
    const method = bytes.readUInt16LE(at + 10)
    const nameLen = bytes.readUInt16LE(at + 28)
    const extra = bytes.readUInt16LE(at + 30) + bytes.readUInt16LE(at + 32)
    const name = bytes.subarray(at + 46, at + 46 + nameLen).toString("utf8")
    const local = bytes.readUInt32LE(at + 42)
    const localName = bytes.readUInt16LE(local + 26)
    const localExtra = bytes.readUInt16LE(local + 28)
    const size = bytes.readUInt32LE(at + 20)
    const start = local + 30 + localName + localExtra
    const compressed = bytes.subarray(start, start + size)
    const raw =
      method === 0 ? Buffer.from(compressed) : inflateRawSync(compressed)
    files.push([name, raw])
    at += 46 + nameLen + extra
  }
  return files
}

function writeZip(files) {
  const locals = []
  const central = []
  let offset = 0
  for (const [name, content] of files) {
    const raw = Buffer.from(content)
    const label = Buffer.from(name)
    const compressed = deflateRawSync(raw)
    const local = Buffer.alloc(30 + label.length)
    local.writeUInt32LE(0x04034b50)
    local.writeUInt16LE(20, 4)
    local.writeUInt16LE(0x800, 6)
    local.writeUInt16LE(8, 8)
    local.writeUInt32LE(crc32(raw), 14)
    local.writeUInt32LE(compressed.length, 18)
    local.writeUInt32LE(raw.length, 22)
    local.writeUInt16LE(label.length, 26)
    label.copy(local, 30)
    const record = Buffer.alloc(46 + label.length)
    record.writeUInt32LE(0x02014b50)
    record.writeUInt16LE(20, 4)
    record.writeUInt16LE(20, 6)
    record.writeUInt16LE(0x800, 8)
    record.writeUInt16LE(8, 10)
    record.writeUInt32LE(crc32(raw), 16)
    record.writeUInt32LE(compressed.length, 20)
    record.writeUInt32LE(raw.length, 24)
    record.writeUInt16LE(label.length, 28)
    record.writeUInt32LE(offset, 42)
    label.copy(record, 46)
    locals.push(local, compressed)
    central.push(record)
    offset += local.length + compressed.length
  }
  const directory = Buffer.concat(central)
  const footer = Buffer.alloc(22)
  footer.writeUInt32LE(0x06054b50)
  footer.writeUInt16LE(central.length, 8)
  footer.writeUInt16LE(central.length, 10)
  footer.writeUInt32LE(directory.length, 12)
  footer.writeUInt32LE(offset, 16)
  return Buffer.concat([...locals, directory, footer])
}

export function member(bytes, name) {
  const found = readZip(bytes).find(([item]) => item === name)
  if (!found) throw new Error(`missing ${name}`)
  return found[1].toString("utf8")
}

export function mainXml(bytes) {
  return member(bytes, "word/document.xml")
}

export function repack(original, documentXml) {
  const files = readZip(original).map(([name, raw]) =>
    name === "word/document.xml"
      ? [name, Buffer.from(documentXml)]
      : [name, raw]
  )
  return writeZip(files)
}

export function partsExceptMain(left, right) {
  const a = new Map(readZip(left))
  const b = new Map(readZip(right))
  const names = [...new Set([...a.keys(), ...b.keys()])]
    .filter((name) => name !== "word/document.xml")
    .sort()
  return names.every((name) =>
    Buffer.from(a.get(name) ?? []).equals(Buffer.from(b.get(name) ?? []))
  )
}

function decode(value) {
  return value
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'")
    .replaceAll("&amp;", "&")
}

function escapeText(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
}

function parseXML(source) {
  if (/<!DOCTYPE|<!ENTITY/i.test(source))
    throw new Error("DTD/entities refused")
  const roots = []
  const stack = []
  let pos = 0
  while (pos < source.length) {
    const start = source.indexOf("<", pos)
    if (start < 0) break
    if (
      source.startsWith("<!--", start) ||
      source.startsWith("<?", start) ||
      source.startsWith("<![CDATA[", start)
    ) {
      const stop = source.startsWith("<!--", start)
        ? "-->"
        : source.startsWith("<?", start)
          ? "?>"
          : "]]>"
      const close = source.indexOf(stop, start + 2)
      if (close < 0) throw new Error("unclosed xml")
      pos = close + stop.length
      continue
    }
    let quote = ""
    let end = start + 1
    for (; end < source.length; end++) {
      const char = source[end]
      if (quote) {
        if (char === quote) quote = ""
      } else if (char === '"' || char === "'") quote = char
      else if (char === ">") break
    }
    if (end === source.length) throw new Error("unclosed xml")
    end += 1
    const token = source.slice(start, end)
    if (token.startsWith("</")) {
      const node = stack.pop()
      if (!node || token.slice(2, -1).trim() !== node.qname)
        throw new Error("xml nesting")
      node.closeStart = start
      node.end = end
    } else {
      const qname = token.match(/^<([^\s/>]+)/)?.[1]
      if (!qname) throw new Error("xml token")
      const parent = stack.at(-1)
      const attrs = []
      for (const match of token.matchAll(/([^\s=<>]+)\s*=\s*(["'])(.*?)\2/g)) {
        const raw = match[1]
        attrs.push({
          local: raw.slice(raw.indexOf(":") + 1),
          value: decode(match[3]),
        })
      }
      const empty = /\/\s*>$/.test(token)
      const node = {
        qname,
        local: qname.slice(qname.indexOf(":") + 1),
        attrs,
        start,
        openEnd: end,
        closeStart: empty ? end : null,
        end: empty ? end : null,
        children: [],
        parent,
      }
      if (parent) parent.children.push(node)
      else roots.push(node)
      if (!empty) stack.push(node)
    }
    pos = end
  }
  if (stack.length || roots.length !== 1) throw new Error("xml root")
  return roots[0]
}

function descendants(node, out = []) {
  for (const child of node.children) {
    out.push(child)
    descendants(child, out)
  }
  return out
}

function is(node, local) {
  return node?.local === local
}

function attr(node, local) {
  return node?.attrs.find((item) => item.local === local)?.value
}

function contentText(node, source) {
  const visit = (current) => {
    if (is(current, "del") || is(current, "moveFrom")) return ""
    if (current !== node && is(current, "p") && is(node, "p")) return ""
    if (["pPr", "rPr", "sectPr"].includes(current.local) && current !== node)
      return ""
    if (is(current, "t"))
      return is(current.parent, "r")
        ? decode(source.slice(current.openEnd, current.closeStart))
        : ""
    return current.children.map(visit).join("")
  }
  return visit(node)
}

export function paragraphsOf(bytes) {
  const xml = mainXml(bytes)
  const root = parseXML(xml)
  const out = []
  for (const node of descendants(root)) {
    if (!is(node, "p")) continue
    let ancestor = node.parent
    let nested = false
    while (ancestor) {
      if (is(ancestor, "p")) nested = true
      ancestor = ancestor.parent
    }
    if (nested) continue
    out.push({ slice: xml.slice(node.start, node.end), node, xml })
  }
  return out
}

export function wordIds(paragraph) {
  return {
    paraId: attr(paragraph.node, "paraId") ?? null,
    textId: attr(paragraph.node, "textId") ?? null,
  }
}

function pPrNode(paragraph) {
  return paragraph.node.children.find((node) => is(node, "pPr")) ?? null
}

export function pPrInner(paragraph) {
  const props = pPrNode(paragraph)
  return props ? paragraph.xml.slice(props.openEnd, props.closeStart) : null
}

export function pStyleOf(paragraph) {
  const style = pPrNode(paragraph)?.children.find((node) => is(node, "pStyle"))
  return style ? (attr(style, "val") ?? null) : null
}

export function runsOf(paragraph) {
  return paragraph.node.children
    .filter((node) => is(node, "r"))
    .map((run) => {
      const props = run.children.find((node) => is(node, "rPr"))
      return {
        text: contentText(run, paragraph.xml),
        rPr: props ? paragraph.xml.slice(props.openEnd, props.closeStart) : "",
        slice: paragraph.xml.slice(run.start, run.end),
        texts: descendants(run).filter((node) => is(node, "t")),
      }
    })
}

export function emptyTextNode(paragraph) {
  const runs = runsOf(paragraph)
  if (runs.length !== 1 || runs[0].texts.length !== 1) return false
  const text = runs[0].texts[0]
  return (
    runs[0].text === "" &&
    paragraph.xml.slice(text.openEnd, text.closeStart) === ""
  )
}

export function hasNum(paragraph) {
  return descendants(paragraph.node).some((node) => is(node, "numPr"))
}

export function hasMark(paragraph) {
  const props = pPrNode(paragraph)
  return (
    !!props &&
    descendants(props).some(
      (node) => is(node, "pPrChange") || is(node, "rPrChange")
    )
  )
}

export function isCarrier(paragraph) {
  const props = pPrNode(paragraph)
  return !!props && descendants(props).some((node) => is(node, "sectPr"))
}

export function sectCount(bytes) {
  return descendants(parseXML(mainXml(bytes))).filter((node) =>
    is(node, "sectPr")
  ).length
}

export function contentOf(paragraph) {
  return contentText(paragraph.node, paragraph.xml)
}

function scalars(text) {
  return [...text]
}

function refused(bytes, side, message) {
  return {
    status: "REFUSED",
    bytes: Buffer.from(bytes),
    sidecar: side,
    message,
  }
}

function rows(paragraphs) {
  return paragraphs.map((row, ordinal) => ({
    key: row.key,
    ordinal,
    textIds: [...row.textIds],
  }))
}

function classRefusal(paragraphs) {
  const writing = paragraphs.filter((paragraph) => !isCarrier(paragraph))
  if (writing.some(hasNum)) return "numbering"
  if (writing.some(hasMark)) return "mark"
  if (new Set(writing.map(pStyleOf)).size > 1) return "styles"
  return null
}

function word(node, local) {
  return node?.qname === `w:${local}`
}

function tracked(node) {
  return /^(?:ins|del|moveFrom|moveTo)$/.test(node.local)
}

function plainRun(run, xml) {
  let texts = 0
  for (const child of run.children) {
    if (word(child, "rPr")) {
      if (descendants(child).some((item) => item.local.endsWith("PrChange")))
        return false
      continue
    }
    if (!word(child, "t")) return false
    const raw = xml.slice(child.openEnd, child.closeStart)
    if (/&#|</.test(raw)) return false
    texts += 1
  }
  return texts > 0
}

function plainParagraph(paragraph) {
  const node = paragraph.node
  if (!word(node.parent, "body") || isCarrier(paragraph)) return false
  if (descendants(node).some(tracked)) return false
  let props = 0
  let runs = 0
  for (const child of node.children) {
    if (word(child, "pPr")) props += 1
    else if (word(child, "r") && plainRun(child, paragraph.xml)) runs += 1
    else return false
  }
  return props < 2 && runs > 0
}

function shapeRefusal(paragraphs) {
  const body = paragraphs[0]?.node.parent
  const last = paragraphs[paragraphs.length - 1]
  if (!body || !word(body, "body") || paragraphs.length < 2 || !last)
    return "shape"
  if (body.children.some((child) => !word(child, "p"))) return "shape"
  if (
    !isCarrier(last) ||
    last.node.children.some((child) => !word(child, "pPr"))
  )
    return "shape"
  if (paragraphs.slice(0, -1).some((paragraph) => !plainParagraph(paragraph)))
    return "shape"
  return null
}

function applied(before, bytes, next, side, paragraphs, options) {
  const packed = repack(bytes, next)
  const after = paragraphsOf(packed)
    .map((paragraph) => contentOf(paragraph))
    .join("")
  if (
    !options.force &&
    before.map((paragraph) => contentOf(paragraph)).join("") !== after
  )
    return refused(bytes, side, "text")
  return {
    status: "APPLIED",
    bytes: packed,
    sidecar: { version: 2, paragraphs },
    message: "",
  }
}

function runXml(text, rPr) {
  const space =
    text.startsWith(" ") || text.endsWith(" ") ? ' xml:space="preserve"' : ""
  const props = rPr ? `<w:rPr>${rPr}</w:rPr>` : ""
  return `<w:r>${props}<w:t${space}>${escapeText(text)}</w:t></w:r>`
}

function paraXml(ids, pPr, inners) {
  const attrs = `${ids.paraId ? ` w14:paraId="${ids.paraId}"` : ""}${ids.textId ? ` w14:textId="${ids.textId}"` : ""}`
  const props = pPr != null ? `<w:pPr>${pPr}</w:pPr>` : ""
  return `<w:p${attrs}>${props}${inners.join("")}</w:p>`
}

function replaceInner(xml, paragraph, text) {
  const texts = runsOf(paragraph)[0]?.texts ?? []
  if (texts.length !== 1) throw new Error("text node")
  const node = texts[0]
  return (
    xml.slice(paragraph.node.start, node.openEnd) +
    escapeText(text) +
    xml.slice(node.closeStart, paragraph.node.end)
  )
}

export function applyCanvasBytes(bytes, edit, side, options = {}) {
  const paragraphs = paragraphsOf(bytes)
  const source = side?.paragraphs
  if (!Array.isArray(source) || source.length !== paragraphs.length)
    return refused(bytes, side, "sidecar")
  const blocked = classRefusal(paragraphs)
  if (blocked && !options.force) return refused(bytes, side, blocked)
  if (shapeRefusal(paragraphs)) return refused(bytes, side, "shape")
  const queue = [...(options.keys ?? [])]
  const take = () => queue.shift() ?? randomUUID()
  const index = source.findIndex((row) => row.key === edit.paragraph)
  if (index < 0) return refused(bytes, side, "missing")
  const xml = mainXml(bytes)
  if (edit.op === "split")
    return splitAt(
      bytes,
      xml,
      paragraphs,
      source,
      side,
      index,
      edit.at,
      take,
      options
    )
  if (edit.op === "mergePrevious")
    return mergeAt(bytes, xml, paragraphs, source, side, index, take, options)
  if (edit.op === "deleteParagraph")
    return deleteAt(bytes, xml, paragraphs, source, side, index, options)
  return refused(bytes, side, "op")
}

function splitAt(
  bytes,
  xml,
  paragraphs,
  source,
  side,
  index,
  caret,
  take,
  options
) {
  const target = paragraphs[index]
  const runs = runsOf(target)
  if (isCarrier(target) || runs.length !== 1 || runs[0].texts.length !== 1)
    return refused(bytes, side, "shape")
  const parts = scalars(runs[0].text)
  if (!Number.isInteger(caret) || caret < 0 || caret > parts.length)
    return refused(bytes, side, "caret")
  const left = parts.slice(0, caret).join("")
  const right = parts.slice(caret).join("")
  const ids = wordIds(target)
  const leftXml =
    left === runs[0].text ? target.slice : replaceInner(xml, target, left)
  const rightXml = paraXml({ paraId: null, textId: null }, pPrInner(target), [
    runXml(right, runs[0].rPr),
  ])
  const next =
    xml.slice(0, target.node.start) +
    leftXml +
    rightXml +
    xml.slice(target.node.end)
  const made = [
    ...source
      .slice(0, index)
      .map((row) => ({ key: row.key, textIds: [...row.textIds] })),
    { key: take(), textIds: [...source[index].textIds] },
    { key: take(), textIds: [] },
    ...source
      .slice(index + 1)
      .map((row) => ({ key: row.key, textIds: [...row.textIds] })),
  ]
  if (
    !options.force &&
    made.some(
      (row, at) => made.findIndex((item) => item.key === row.key) !== at
    )
  )
    return refused(bytes, side, "key")
  return applied(paragraphs, bytes, next, side, rows(made), options)
}

function mergeAt(bytes, xml, paragraphs, source, side, index, take, options) {
  const previous = index - 1
  if (
    previous < 0 ||
    isCarrier(paragraphs[index]) ||
    isCarrier(paragraphs[previous]) ||
    (!options.force && contentOf(paragraphs[index]) === "")
  )
    return refused(bytes, side, "merge")
  const first = paragraphs[previous]
  const second = paragraphs[index]
  const moved = [...runsOf(first), ...runsOf(second)].map((run) => run.slice)
  const merged = paraXml(wordIds(first), pPrInner(first), moved)
  const next =
    xml.slice(0, first.node.start) + merged + xml.slice(second.node.end)
  const kept = source.filter((_, at) => at !== index)
  kept[previous] = { key: take(), textIds: [...source[previous].textIds] }
  return applied(paragraphs, bytes, next, side, rows(kept), options)
}

function deleteAt(bytes, xml, paragraphs, source, side, index, options) {
  const target = paragraphs[index]
  if (!options.force && (!plainParagraph(target) || contentOf(target) !== ""))
    return refused(bytes, side, "empty")
  const next = xml.slice(0, target.node.start) + xml.slice(target.node.end)
  return applied(
    paragraphs,
    bytes,
    next,
    side,
    rows(source.filter((_, at) => at !== index)),
    options
  )
}

export function packageFromBody(body) {
  const types = `<Types xmlns="${TYPES}"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>`
  const root = `<Relationships xmlns="${PKG}"><Relationship Id="main" Type="${REL}/officeDocument" Target="word/document.xml"/></Relationships>`
  const document = `<w:document xmlns:w="${WORD}" xmlns:r="${REL}" xmlns:w14="${W14}"><w:body>${body}</w:body></w:document>`
  const styles = `<w:styles xmlns:w="${WORD}" xmlns:r="${REL}"><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/></w:style></w:styles>`
  const rels = `<Relationships xmlns="${PKG}"><Relationship Id="styles" Type="${REL}/styles" Target="styles.xml"/></Relationships>`
  return writeZip([
    ["[Content_Types].xml", types],
    ["_rels/.rels", root],
    ["word/document.xml", document],
    ["word/styles.xml", styles],
    ["word/_rels/document.xml.rels", rels],
  ])
}

function painted(text, pPr = PPR, paraId = "11111111", textId = "11111112") {
  return paraXml({ paraId, textId }, pPr, [runXml(text, RPR)])
}

export function mintBlankBytes() {
  return packageFromBody(
    painted("") + paraXml({ paraId: "22222221", textId: "22222222" }, SECT, [])
  )
}

export function fillPaintedText(bytes, text) {
  const xml = mainXml(bytes)
  const from = "<w:t></w:t>"
  if (xml.split(from).length !== 2) throw new Error("empty text is not unique")
  return repack(bytes, xml.replace(from, `<w:t>${escapeText(text)}</w:t>`))
}

export const canvasMarks = { PPR, RPR, SECT }
