import type {
  Block,
  Document,
  PageSetup,
  Run,
} from "@workspace/domain/paper-doc"

import { WORD_NS } from "../import/package-xml.js"
import { numberingXml, styleIds, stylesXml } from "./word-styles.js"
import {
  drawing,
  officeRelationships,
  picture,
  twips,
  val,
  wordDrawing,
  wordFont,
  xml,
} from "./word-xml.js"
import { zipDocx } from "./zip-docx.js"

type ImageBlock = Extract<Block, { type: "image" }>
type TextBlock = Extract<Block, { type: "text_block" }>
type TableBlock = Extract<Block, { type: "table" }>
type FileId = ImageBlock["attrs"]["fileId"]
type ListKind = NonNullable<TextBlock["attrs"]["list"]>

const imageExtensions = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
}

export type WordFiles = ReadonlyMap<
  FileId,
  {
    bytes: Uint8Array
    mediaType: keyof typeof imageExtensions
  }
>

const packageRelationships =
  "http://schemas.openxmlformats.org/package/2006/relationships"
const contentTypeNamespace =
  "http://schemas.openxmlformats.org/package/2006/content-types"
const wordContentType =
  "application/vnd.openxmlformats-officedocument.wordprocessingml"

function relationship(id: string, kind: string, target: string) {
  return `<Relationship Id="${id}" Type="${officeRelationships}/${kind}" Target="${xml(target)}"${kind === "hyperlink" ? ' TargetMode="External"' : ""}/>`
}

const relations = (items: readonly string[]) =>
  `<Relationships xmlns="${packageRelationships}">${items.join("")}</Relationships>`

function section({ size, orientation, marginsMpt }: PageSetup) {
  const [width, height] = size === "A4" ? [11906, 16838] : [12240, 15840]
  const page =
    orientation === "landscape"
      ? `w:w="${height}" w:h="${width}" w:orient="landscape"`
      : `w:w="${width}" w:h="${height}"`
  const { top, right, bottom, left } = marginsMpt
  return `<w:sectPr><w:pgSz ${page}/><w:pgMar w:top="${twips(top)}" w:right="${twips(right)}" w:bottom="${twips(bottom)}" w:left="${twips(left)}" w:header="0" w:footer="0" w:gutter="0"/></w:sectPr>`
}

const alignment = (align: TextBlock["attrs"]["align"]) =>
  val("jc", align === "justify" ? "both" : align)

function textRun(run: Extract<Run, { type: "text" }>) {
  const props = (run.marks ?? [])
    .map((mark) => {
      switch (mark.type) {
        case "bold":
          return "<w:b/>"
        case "italic":
          return "<w:i/>"
        case "strike":
          return "<w:strike/>"
        case "underline":
          return val("u", "single")
        case "color":
          return val("color", mark.attrs.value.slice(1).toUpperCase())
        case "font":
          return wordFont(mark.attrs.family)
        case "size":
          return val("sz", Math.max(1, Math.round(mark.attrs.mpt / 500)))
        case "link":
          return val("rStyle", "Hyperlink")
      }
    })
    .join("")
  const content = run.text
    .split(/(\t|\r\n|\r|\n)/u)
    .map((text) => {
      if (!text) return ""
      if (text === "\t") return "<w:tab/>"
      if (text === "\r" || text === "\n" || text === "\r\n") return "<w:br/>"
      return `<w:t xml:space="preserve">${xml(text)}</w:t>`
    })
    .join("")
  return `<w:r>${props ? `<w:rPr>${props}</w:rPr>` : ""}${content}</w:r>`
}

function paragraph(attrs: TextBlock["attrs"], runs: string, listId?: number) {
  const style =
    attrs.list && attrs.kind === "paragraph"
      ? "ListParagraph"
      : styleIds[attrs.kind]
  const keepNext =
    attrs.keepWithNext === null
      ? ""
      : val("keepNext", Number(attrs.keepWithNext))
  const numbered =
    listId === undefined
      ? ""
      : `<w:numPr>${val("ilvl", attrs.level)}${val("numId", listId)}</w:numPr>`
  const tabs =
    attrs.rightTabMpt === undefined
      ? ""
      : `<w:tabs><w:tab w:val="right" w:pos="${twips(attrs.rightTabMpt)}"/></w:tabs>`
  const spacing =
    attrs.lineSpacing === null
      ? ""
      : `<w:spacing w:line="${Math.max(1, Math.round(attrs.lineSpacing * 240))}" w:lineRule="auto"/>`
  return `<w:p><w:pPr>${val("pStyle", style)}${keepNext}${numbered}${tabs}${spacing}${alignment(attrs.align)}</w:pPr>${runs}</w:p>`
}

function image(attrs: ImageBlock["attrs"], relId: string, drawingId: number) {
  const width = Math.round(attrs.widthMpt * 12.7)
  const height = Math.round(attrs.heightMpt * 12.7)
  const description = `id="${drawingId}" name="Picture ${drawingId}" descr="${xml(attrs.alt)}"`
  return (
    `<w:p><w:pPr>${alignment(attrs.align)}</w:pPr><w:r><w:drawing><wp:inline>` +
    `<wp:extent cx="${width}" cy="${height}"/><wp:docPr ${description}/>` +
    `<a:graphic><a:graphicData uri="${picture}"><pic:pic>` +
    `<pic:nvPicPr><pic:cNvPr ${description}/><pic:cNvPicPr/></pic:nvPicPr>` +
    `<pic:blipFill><a:blip r:embed="${relId}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>` +
    `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${width}" cy="${height}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>` +
    `</pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`
  )
}

function table(block: TableBlock, runsXml: (runs?: Run[]) => string) {
  const widths = block.attrs.columnsMpt.map(twips)
  const total = widths.reduce((sum, width) => sum + width, 0)
  const borders = ["top", "left", "bottom", "right", "insideH", "insideV"]
    .map((side) =>
      block.attrs.borders === "all"
        ? `<w:${side} w:val="single" w:sz="4" w:color="auto"/>`
        : val(side, "nil")
    )
    .join("")
  const columns = widths.map((width) => `<w:gridCol w:w="${width}"/>`).join("")
  const rows = block.content
    .map((row) => {
      const cells = row.content
        .map(
          (cell, index) =>
            `<w:tc><w:tcPr><w:tcW w:w="${widths[index]}" w:type="dxa"/></w:tcPr><w:p>${runsXml(cell.content)}</w:p></w:tc>`
        )
        .join("")
      return `<w:tr>${cells}</w:tr>`
    })
    .join("")
  return `<w:tbl><w:tblPr><w:tblW w:w="${total}" w:type="dxa"/><w:tblBorders>${borders}</w:tblBorders><w:tblLayout w:type="fixed"/></w:tblPr><w:tblGrid>${columns}</w:tblGrid>${rows}</w:tbl>`
}

export function writeDocx(doc: Document, files: WordFiles): Buffer {
  const parts = new Map<string, string | Uint8Array>()
  const docRelationships = [
    relationship("styles", "styles", "styles.xml"),
    relationship("numbering", "numbering", "numbering.xml"),
  ]
  const links = new Map<string, string>()
  const embedded = new Map<FileId, string>()
  const imageTypes = new Set<keyof typeof imageExtensions>()
  const lists: ListKind[] = []
  const activeLists = new Map<ListKind, number>()
  let drawings = 0

  function runsXml(runs: Run[] = []) {
    const output: string[] = []
    let activeLink: string | undefined
    for (const run of runs) {
      const link =
        run.type === "text"
          ? run.marks?.find((mark) => mark.type === "link")?.attrs.href
          : undefined
      if (link !== activeLink) {
        if (activeLink) output.push("</w:hyperlink>")
        if (link) {
          let relId = links.get(link)
          if (!relId) {
            relId = `link${links.size + 1}`
            links.set(link, relId)
            docRelationships.push(relationship(relId, "hyperlink", link))
          }
          output.push(`<w:hyperlink r:id="${relId}">`)
        }
        activeLink = link
      }
      output.push(
        run.type === "hard_break" ? "<w:r><w:br/></w:r>" : textRun(run)
      )
    }
    if (activeLink) output.push("</w:hyperlink>")
    return output.join("")
  }

  const body = doc.content
    .map((block) => {
      const list = block.type === "text_block" ? block.attrs.list : null
      if (!list) activeLists.clear()
      switch (block.type) {
        case "text_block": {
          let listId = list ? activeLists.get(list) : undefined
          if (list && listId === undefined) {
            listId = lists.push(list)
            activeLists.set(list, listId)
          }
          return paragraph(block.attrs, runsXml(block.content), listId)
        }
        case "image": {
          const { fileId } = block.attrs
          let relId = embedded.get(fileId)
          if (!relId) {
            const file = files.get(fileId)
            if (!file?.bytes.length)
              throw new Error(`Missing Word image ${fileId}`)
            relId = `image${embedded.size + 1}`
            const target = `media/${relId}.${imageExtensions[file.mediaType]}`
            embedded.set(fileId, relId)
            imageTypes.add(file.mediaType)
            parts.set(`word/${target}`, file.bytes)
            docRelationships.push(relationship(relId, "image", target))
          }
          return image(block.attrs, relId, ++drawings)
        }
        case "table":
          return table(block, runsXml)
        case "page_break":
          return '<w:p><w:r><w:br w:type="page"/></w:r></w:p>'
        case "divider":
          return '<w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="auto"/></w:pBdr></w:pPr></w:p>'
      }
    })
    .join("")

  const media = [...imageTypes]
    .map(
      (type) =>
        `<Default Extension="${imageExtensions[type]}" ContentType="${type}"/>`
    )
    .join("")
  parts.set(
    "[Content_Types].xml",
    `<Types xmlns="${contentTypeNamespace}"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>${media}` +
      `<Override PartName="/word/document.xml" ContentType="${wordContentType}.document.main+xml"/>` +
      `<Override PartName="/word/styles.xml" ContentType="${wordContentType}.styles+xml"/>` +
      `<Override PartName="/word/numbering.xml" ContentType="${wordContentType}.numbering+xml"/></Types>`
  )
  parts.set(
    "_rels/.rels",
    relations([relationship("document", "officeDocument", "word/document.xml")])
  )
  parts.set("word/_rels/document.xml.rels", relations(docRelationships))
  parts.set("word/styles.xml", stylesXml(doc.attrs.template))
  parts.set("word/numbering.xml", numberingXml(lists))
  parts.set(
    "word/document.xml",
    `<w:document xmlns:w="${WORD_NS}" xmlns:r="${officeRelationships}" xmlns:wp="${wordDrawing}" xmlns:a="${drawing}" xmlns:pic="${picture}"><w:body>${body}${section(doc.attrs.page)}</w:body></w:document>`
  )
  return zipDocx(parts)
}
