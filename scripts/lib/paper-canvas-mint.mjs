import {
  PKG,
  REL,
  TYPES,
  W14,
  WORD,
  escapeText,
  mainXml,
  paraXml,
  repack,
  runXml,
  writeZip,
} from "./paper-canvas-bytes.mjs"

const PPR = '<w:pStyle w:val="Normal"/><w:jc w:val="center"/>'
const RPR = '<w:color w:val="231F20"/>'
const SECT =
  '<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr>'

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
