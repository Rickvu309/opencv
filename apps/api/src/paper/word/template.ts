import { createRequire } from "node:module"

import type { PaperTemplateId } from "@workspace/domain"

const canvas = createRequire(import.meta.url)(
  "../../../../../scripts/lib/paper-canvas-bytes.mjs"
) as {
  WORD: string
  REL: string
  PKG: string
  TYPES: string
  W14: string
  canvasMarks: { SECT: string }
  paraXml: (
    ids: { paraId: string; textId: string },
    pPr: string | null,
    inners: string[]
  ) => string
  runXml: (text: string, rPr: string | null) => string
  writeZip: (files: [string, string][]) => Uint8Array
}

type TemplateStyle = "Title" | "Heading1" | "ListBullet" | "Normal"

export type TemplateLine = {
  readonly style: TemplateStyle
  readonly text: string
  readonly center?: true
}

type SectionKind =
  "summary" | "experience" | "education" | "skills" | "projects"

type TemplateLayout = "simple" | "modern" | "compact" | "academic" | "photo"

const LAYOUT_SECTIONS: Record<
  TemplateLayout,
  readonly (readonly [SectionKind, string])[]
> = {
  simple: [
    ["summary", "Summary"],
    ["experience", "Experience"],
    ["education", "Education"],
    ["skills", "Skills"],
  ],
  modern: [
    ["summary", "Profile"],
    ["experience", "Experience"],
    ["projects", "Selected work"],
  ],
  compact: [
    ["experience", "Work experience"],
    ["summary", "About"],
    ["education", "Education"],
    ["skills", "Skills"],
  ],
  academic: [
    ["education", "Education"],
    ["projects", "Projects & campus"],
    ["experience", "Experience"],
    ["skills", "Skills & languages"],
  ],
  photo: [
    ["summary", "Summary"],
    ["experience", "Experience"],
    ["education", "Education"],
    ["skills", "Skills"],
  ],
}

const SECTION_LINES: Record<SectionKind, readonly TemplateLine[]> = {
  summary: [
    {
      style: "Normal",
      text: "[Two or three lines on who you are and the work you want]",
    },
  ],
  experience: [
    { style: "Normal", text: "[Role, company] | [Dates]" },
    {
      style: "ListBullet",
      text: "[What you did, and what changed because of it]",
    },
  ],
  education: [
    { style: "Normal", text: "[School, degree] | [Dates]" },
    { style: "ListBullet", text: "[A course, result or project worth naming]" },
  ],
  skills: [{ style: "Normal", text: "[Tools, software and languages]" }],
  projects: [
    { style: "Normal", text: "[Project or role] | [Dates]" },
    {
      style: "ListBullet",
      text: "[What you made, and what changed because of it]",
    },
  ],
}

const HEADER_LINES: readonly TemplateLine[] = [
  { style: "Title", text: "[Your name]", center: true },
  { style: "Normal", text: "[Headline]", center: true },
  {
    style: "Normal",
    text: "[Email] | [Phone] | [City] | [LinkedIn]",
    center: true,
  },
]

function layoutOf(templateId: PaperTemplateId): TemplateLayout {
  switch (templateId) {
    case "modern":
      return "modern"
    case "compact":
      return "compact"
    case "academic":
      return "academic"
    case "with-photo":
      return "photo"
    default:
      return "simple"
  }
}

export function templateLines(templateId: PaperTemplateId): TemplateLine[] {
  return [
    ...HEADER_LINES,
    ...LAYOUT_SECTIONS[layoutOf(templateId)].flatMap(([kind, title]) => [
      { style: "Heading1" as const, text: title },
      ...SECTION_LINES[kind],
    ]),
  ]
}

function templateLabel(templateId: PaperTemplateId) {
  if (templateId === "with-photo") return "With photo"
  if (templateId === "two-column") return "Two column"
  return templateId.charAt(0).toUpperCase() + templateId.slice(1)
}

export function templatePageName(templateId: PaperTemplateId) {
  return `${templateLabel(templateId)} CV.docx`
}

const STYLES = `<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:sz w:val="22"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="120"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style><w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:pPr><w:spacing w:after="60"/></w:pPr><w:rPr><w:b/><w:sz w:val="40"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:pPr><w:keepNext/><w:pBdr><w:bottom w:val="single" w:sz="4" w:space="1" w:color="auto"/></w:pBdr><w:spacing w:before="240" w:after="80"/><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:sz w:val="26"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="ListBullet"><w:name w:val="List Bullet"/><w:basedOn w:val="Normal"/><w:pPr><w:numPr><w:numId w:val="1"/></w:numPr><w:ind w:left="360" w:hanging="360"/></w:pPr></w:style>`

const NUMBERING = `<w:abstractNum w:abstractNumId="0"><w:multiLevelType w:val="singleLevel"/><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="•"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="360" w:hanging="360"/></w:pPr></w:lvl></w:abstractNum><w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>`

function idsAt(index: number) {
  return {
    paraId: (0x10000000 + index).toString(16).toUpperCase(),
    textId: (0x20000000 + index).toString(16).toUpperCase(),
  }
}

function lineXml(line: TemplateLine, index: number) {
  const style =
    line.style === "Normal" ? "" : `<w:pStyle w:val="${line.style}"/>`
  const align = line.center ? '<w:jc w:val="center"/>' : ""
  const props = style + align
  return canvas.paraXml(idsAt(index), props === "" ? null : props, [
    canvas.runXml(line.text, null),
  ])
}

export function templatePageBytes(templateId: PaperTemplateId): Uint8Array {
  return pageBytesOf(templateLines(templateId))
}

export function writtenPageBytes(lines: readonly string[]): Uint8Array {
  return pageBytesOf(lines.map((text) => ({ style: "Normal", text })))
}

function pageBytesOf(lines: readonly TemplateLine[]): Uint8Array {
  const { WORD, REL, PKG, TYPES, W14 } = canvas
  const body =
    lines.map(lineXml).join("") +
    canvas.paraXml(idsAt(lines.length), canvas.canvasMarks.SECT, [])
  const part = (name: string) =>
    `application/vnd.openxmlformats-officedocument.wordprocessingml.${name}+xml`
  return canvas.writeZip([
    [
      "[Content_Types].xml",
      `<Types xmlns="${TYPES}"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="${part("document.main")}"/><Override PartName="/word/styles.xml" ContentType="${part("styles")}"/><Override PartName="/word/numbering.xml" ContentType="${part("numbering")}"/></Types>`,
    ],
    [
      "_rels/.rels",
      `<Relationships xmlns="${PKG}"><Relationship Id="main" Type="${REL}/officeDocument" Target="word/document.xml"/></Relationships>`,
    ],
    [
      "word/document.xml",
      `<w:document xmlns:w="${WORD}" xmlns:r="${REL}" xmlns:w14="${W14}"><w:body>${body}</w:body></w:document>`,
    ],
    ["word/styles.xml", `<w:styles xmlns:w="${WORD}">${STYLES}</w:styles>`],
    [
      "word/numbering.xml",
      `<w:numbering xmlns:w="${WORD}">${NUMBERING}</w:numbering>`,
    ],
    [
      "word/_rels/document.xml.rels",
      `<Relationships xmlns="${PKG}"><Relationship Id="styles" Type="${REL}/styles" Target="styles.xml"/><Relationship Id="numbering" Type="${REL}/numbering" Target="numbering.xml"/></Relationships>`,
    ],
  ])
}
