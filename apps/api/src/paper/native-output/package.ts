import { createRequire } from "node:module"

import { paperLinkColor } from "@workspace/domain/internal/paper-presentation"

import { z } from "zod"

import { xml, type ExternalLink } from "./rich-text.js"
import type { WordMedia } from "./formatted-photos.js"

const required: unknown = createRequire(import.meta.url)(
  "../../../../../scripts/lib/paper-canvas-bytes.mjs"
)
const { writeZip } = z
  .object({
    writeZip: z.custom<(files: [string, string | Uint8Array][]) => Uint8Array>(
      (value) => typeof value === "function"
    ),
  })
  .parse(required)

export const WORD_NS =
  "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
const REL_NS =
  "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
const PKG_NS = "http://schemas.openxmlformats.org/package/2006/relationships"
const TYPES_NS = "http://schemas.openxmlformats.org/package/2006/content-types"
const CUSTOM_NS =
  "http://schemas.openxmlformats.org/officeDocument/2006/custom-properties"
const XML_START = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'

function wordPart(name: string, body: string): string {
  return `${XML_START}<w:${name} xmlns:w="${WORD_NS}" xmlns:r="${REL_NS}">${body}</w:${name}>`
}

export function wordPackage(input: {
  body: string
  styles: string
  numbering: string
  links: readonly ExternalLink[]
  identity: readonly (readonly [string, string])[]
  media?: readonly WordMedia[]
}): Uint8Array {
  const overrides = [
    ["/word/document.xml", "document.main"],
    ["/word/styles.xml", "styles"],
    ["/word/numbering.xml", "numbering"],
  ]
    .map(
      ([name, kind]) =>
        `<Override PartName="${name}" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.${kind}+xml"/>`
    )
    .join("")
  const relationships = [
    '<Relationship Id="styles" Type="' +
      REL_NS +
      '/styles" Target="styles.xml"/>',
    '<Relationship Id="numbering" Type="' +
      REL_NS +
      '/numbering" Target="numbering.xml"/>',
    ...input.links.map(
      ({ id, target }) =>
        `<Relationship Id="${id}" Type="${REL_NS}/hyperlink" Target="${xml(target)}" TargetMode="External"/>`
    ),
    ...(input.media ?? []).map(
      ({ id, name }) =>
        `<Relationship Id="${id}" Type="${REL_NS}/image" Target="media/${xml(name)}"/>`
    ),
  ].join("")
  const identity = input.identity
    .map(
      ([name, value], index) =>
        `<property fmtid="{D5CDD505-2E9C-101B-9397-08002B2CF9AE}" pid="${index + 2}" name="${xml(name)}"><vt:lpwstr>${xml(value)}</vt:lpwstr></property>`
    )
    .join("")
  return writeZip([
    [
      "[Content_Types].xml",
      `${XML_START}<Types xmlns="${TYPES_NS}"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>${overrides}${(input.media ?? []).map(({ name, mediaType }) => `<Override PartName="/word/media/${xml(name)}" ContentType="${xml(mediaType)}"/>`).join("")}<Override PartName="/docProps/custom.xml" ContentType="application/vnd.openxmlformats-officedocument.custom-properties+xml"/></Types>`,
    ],
    [
      "_rels/.rels",
      `${XML_START}<Relationships xmlns="${PKG_NS}"><Relationship Id="document" Type="${REL_NS}/officeDocument" Target="word/document.xml"/><Relationship Id="identity" Type="${REL_NS}/custom-properties" Target="docProps/custom.xml"/></Relationships>`,
    ],
    [
      "word/document.xml",
      wordPart("document", `<w:body>${input.body}</w:body>`),
    ],
    [
      "word/_rels/document.xml.rels",
      `${XML_START}<Relationships xmlns="${PKG_NS}">${relationships}</Relationships>`,
    ],
    [
      "word/styles.xml",
      wordPart(
        "styles",
        input.styles +
          (input.links.length
            ? `<w:style w:type="character" w:styleId="Hyperlink"><w:name w:val="Hyperlink"/><w:rPr><w:color w:val="${paperLinkColor.slice(1)}"/><w:u w:val="single"/></w:rPr></w:style>`
            : "")
      ),
    ],
    ["word/numbering.xml", wordPart("numbering", input.numbering)],
    ...(input.media ?? []).map(({ name, bytes }): [string, Uint8Array] => [
      `word/media/${name}`,
      bytes,
    ]),
    [
      "docProps/custom.xml",
      `${XML_START}<Properties xmlns="${CUSTOM_NS}" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">${identity}</Properties>`,
    ],
  ])
}
