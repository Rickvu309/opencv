import {
  nativePaperDocumentSchema,
  type NativePaperDocument,
  type ProseBlock,
} from "@workspace/domain"

import { numberingXml, type ListSequence } from "./numbering.js"
import { letterPackage } from "./package.js"
import { LETTER_PROFILE } from "./profile.js"
import {
  assertCanonicalInput,
  richRuns,
  xml,
  type ExternalLink,
} from "./rich-text.js"

export { LETTER_PROFILE } from "./profile.js"

function stylesXml(): string {
  const p = LETTER_PROFILE
  const headings = ([2, 3] satisfies (2 | 3)[])
    .map(
      (level) =>
        `<w:style w:type="paragraph" w:styleId="Heading${level}"><w:name w:val="heading ${level}"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:pPr><w:keepNext/><w:keepLines/><w:spacing w:before="${p.headingBefore}" w:after="${p.after}"/><w:outlineLvl w:val="${level - 1}"/></w:pPr><w:rPr><w:b/><w:sz w:val="${level === 2 ? p.heading2Size : p.heading3Size}"/><w:szCs w:val="${level === 2 ? p.heading2Size : p.heading3Size}"/></w:rPr></w:style>`
    )
    .join("")
  return `<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="${xml(p.font)}" w:hAnsi="${xml(p.font)}" w:eastAsia="${xml(p.font)}" w:cs="${xml(p.font)}"/><w:sz w:val="${p.size}"/><w:szCs w:val="${p.size}"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="${p.after}" w:line="${p.line}" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:pPr><w:widowControl/></w:pPr></w:style>${headings}`
}

type NativeLetter = Extract<NativePaperDocument, { kind: "letter" }>

function project(document: NativeLetter): {
  body: string
  sequences: ListSequence[]
  links: ExternalLink[]
} {
  const sequences: ListSequence[] = []
  const links: ExternalLink[] = []
  function siblings(blocks: readonly ProseBlock[], depth: number): string {
    let sequence: ListSequence | undefined
    return blocks
      .map((block) => {
        if (block.type === "bullet" || block.type === "numbered") {
          if (!sequence || sequence.kind !== block.type) {
            sequence = { id: sequences.length + 1, kind: block.type, depth }
            sequences.push(sequence)
          }
          const paragraph = `<w:p><w:pPr><w:numPr><w:ilvl w:val="${depth}"/><w:numId w:val="${sequence.id}"/></w:numPr></w:pPr>${richRuns(block.content, links)}</w:p>`
          return paragraph + siblings(block.children, depth + 1)
        }
        sequence = undefined
        switch (block.type) {
          case "paragraph":
            return `<w:p>${richRuns(block.content, links)}</w:p>`
          case "heading":
            return `<w:p><w:pPr><w:pStyle w:val="Heading${block.level}"/></w:pPr>${richRuns(block.content, links)}</w:p>`
          case "divider": {
            const p = LETTER_PROFILE
            return `<w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="${p.dividerSize}" w:space="${p.dividerSpace}" w:color="${p.dividerColor}"/></w:pBdr></w:pPr></w:p>`
          }
          default: {
            const exhaustive: never = block
            throw new Error(`Unsupported native Letter block: ${exhaustive}`)
          }
        }
      })
      .join("")
  }
  return { body: siblings(document.blocks, 0), sequences, links }
}

export function compileNativeLetterDocx(input: {
  document: unknown
  templateId: string
  profileId: string
}): Uint8Array {
  if (
    input.templateId !== LETTER_PROFILE.templateId ||
    input.profileId !== LETTER_PROFILE.id
  )
    throw new Error("Unsupported native Letter template or profile")
  assertCanonicalInput(input.document)
  const document = nativePaperDocumentSchema.parse(input.document)
  if (document.kind !== "letter")
    throw new Error("Native Letter output refuses CV documents")
  if (document.clashes.length)
    throw new Error("Native Letter output refuses unresolved clashes")
  const { body, sequences, links } = project(document)
  const p = LETTER_PROFILE
  const geometry = `<w:sectPr><w:pgSz w:w="${p.pageWidth}" w:h="${p.pageHeight}"/><w:pgMar w:top="${p.margin}" w:right="${p.margin}" w:bottom="${p.margin}" w:left="${p.margin}" w:header="0" w:footer="0" w:gutter="0"/></w:sectPr>`
  return letterPackage({
    body: body + geometry,
    styles: stylesXml(),
    numbering: numberingXml(sequences),
    links,
  })
}
