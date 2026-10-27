import { z } from "zod"

import {
  cvDocumentV1Schema,
  cvTemplateIdSchema,
  isCvDocument,
  type CvDocument,
  type CvEducation,
  type CvExperience,
  type CvProject,
  type CvSkillGroup,
  type CvTemplateId,
} from "./paper-codecs.js"

export const IMPORT_PAGES_MESSAGE =
  "Pages files aren't supported. Try a PDF or Word file."
export const IMPORT_GOOGLE_MESSAGE =
  "Google Docs aren't supported. Download a PDF or Word file."
export const IMPORT_LINKEDIN_MESSAGE =
  "LinkedIn links aren't supported. Download a PDF or Word file."
export const IMPORT_PHONE_MESSAGE = "No phone number in your file."
export const IMPORT_DATES_MESSAGE = "Add when you did this role."

const blockIdSchema = z.string().min(1)

const textBlockSchema = z
  .object({
    id: blockIdSchema,
    type: z.enum(["heading", "text"]),
    text: z.string(),
  })
  .strict()

const listBlockSchema = z
  .object({
    id: blockIdSchema,
    type: z.enum(["bulleted-list", "numbered-list"]),
    items: z.array(
      z
        .object({
          id: blockIdSchema,
          text: z.string(),
        })
        .strict()
    ),
  })
  .strict()

const dividerBlockSchema = z
  .object({
    id: blockIdSchema,
    type: z.literal("divider"),
  })
  .strict()

export const cvBlockSchema = z.union([
  textBlockSchema,
  listBlockSchema,
  dividerBlockSchema,
])

export const cvSectionKindSchema = z.enum([
  "summary",
  "experience",
  "education",
  "skills",
  "projects",
  "activities",
  "awards",
  "languages",
])

export const cvBlockDocumentSchema = z
  .object({
    version: z.literal(2),
    header: z
      .object({
        name: z.string(),
        email: z.string(),
        phone: z.string(),
        city: z.string(),
        linkedin: z.string(),
        photo: z.string().optional(),
      })
      .strict(),
    sections: z.array(
      z
        .object({
          id: blockIdSchema,
          kind: cvSectionKindSchema,
          blocks: z.array(cvBlockSchema),
        })
        .strict()
    ),
  })
  .strict()

export type CvBlock = z.infer<typeof cvBlockSchema>
export type CvSectionKind = z.infer<typeof cvSectionKindSchema>
export type CvBlockDocument = z.infer<typeof cvBlockDocumentSchema>
export type CvImportCheck = {
  id: string
  kind: "phone" | "dates"
  blockId: string
  message: string
  resolved: boolean
}

const CORE_KINDS = new Set<CvSectionKind>(["experience", "education", "skills"])

export function isCoreSection(kind: CvSectionKind) {
  return CORE_KINDS.has(kind)
}

export function isCvBlockDocument(value: unknown): value is CvBlockDocument {
  return cvBlockDocumentSchema.safeParse(value).success
}

export function blankBlockDocument(): CvBlockDocument {
  return {
    version: 2,
    header: {
      name: "",
      email: "",
      phone: "",
      city: "",
      linkedin: "",
    },
    sections: [
      {
        id: "section-experience",
        kind: "experience",
        blocks: [
          { id: "block-role", type: "heading", text: "" },
          { id: "block-dates", type: "text", text: "" },
          { id: "block-impact", type: "text", text: "" },
        ],
      },
      {
        id: "section-education",
        kind: "education",
        blocks: [{ id: "block-school", type: "heading", text: "" }],
      },
      {
        id: "section-skills",
        kind: "skills",
        blocks: [{ id: "block-tools", type: "text", text: "" }],
      },
    ],
  }
}

function makeIds() {
  let n = 0
  return () => {
    n += 1
    return `cv-${n}`
  }
}

function textBlock(id: () => string, text: string): CvBlock {
  return { id: id(), type: "text", text }
}

function headingBlock(id: () => string, text: string): CvBlock {
  return { id: id(), type: "heading", text }
}

export function cvCodecToBlocks(document: CvDocument): CvBlockDocument {
  const id = makeIds()
  const sections: CvBlockDocument["sections"] = []
  const headline = document.headline
  const summary = document.summary
  if (headline || summary) {
    const blocks: CvBlock[] = [textBlock(id, headline)]
    if (summary && summary !== headline) blocks.push(textBlock(id, summary))
    sections.push({ id: id(), kind: "summary", blocks })
  }
  if (document.experience.length > 0) {
    const blocks: CvBlock[] = []
    for (const role of document.experience) {
      const title = role.company ? `${role.role}, ${role.company}` : role.role
      blocks.push(headingBlock(id, title))
      blocks.push(textBlock(id, role.period))
      blocks.push({
        id: id(),
        type: "bulleted-list",
        items: role.bullets.map((text) => ({ id: id(), text })),
      })
    }
    sections.push({ id: id(), kind: "experience", blocks })
  }
  if (document.education.length > 0) {
    const blocks: CvBlock[] = []
    for (const school of document.education) {
      const title = school.degree
        ? `${school.school}, ${school.degree}`
        : school.school
      blocks.push(headingBlock(id, title))
      blocks.push(textBlock(id, school.period))
      if (school.detail) blocks.push(textBlock(id, school.detail))
    }
    sections.push({ id: id(), kind: "education", blocks })
  }
  const skillItems = document.skills.flatMap((group) => group.items)
  if (skillItems.length > 0) {
    sections.push({
      id: id(),
      kind: "skills",
      blocks: [textBlock(id, skillItems.join(", "))],
    })
  }
  const projects = document.projects ?? []
  if (projects.length > 0) {
    const blocks: CvBlock[] = []
    for (const project of projects) {
      blocks.push(headingBlock(id, project.name))
      blocks.push(textBlock(id, project.detail))
    }
    sections.push({ id: id(), kind: "projects", blocks })
  }
  const languages = document.languages ?? []
  if (languages.length > 0) {
    sections.push({
      id: id(),
      kind: "languages",
      blocks: [textBlock(id, languages.join(", "))],
    })
  }
  const header: CvBlockDocument["header"] = {
    name: document.name,
    email: document.contact.email,
    phone: document.contact.phone,
    city: document.contact.location,
    linkedin: document.contact.linkedin ?? "",
  }
  if (document.photoUrl) header.photo = document.photoUrl
  return { version: 2, header, sections }
}

function splitComma(text: string): [string, string] {
  const index = text.indexOf(",")
  if (index < 0) return [text.trim(), ""]
  return [text.slice(0, index).trim(), text.slice(index + 1).trim()]
}

function blockText(block: CvBlock | undefined) {
  if (!block || block.type === "divider") return ""
  if ("items" in block) {
    return block.items.map((item) => item.text).join("\n")
  }
  return block.text
}

export function blocksToCvCodec(
  document: CvBlockDocument,
  templateId: CvTemplateId = "internship"
): CvDocument {
  const experience: CvExperience[] = []
  const education: CvEducation[] = []
  const projects: CvProject[] = []
  let skills: CvSkillGroup[] = []
  let languages: string[] = []
  let headline = ""
  let summary = ""

  for (const section of document.sections) {
    if (section.kind === "summary") {
      const texts = section.blocks.filter(
        (block) => block.type === "text" || block.type === "heading"
      )
      headline = blockText(texts[0])
      summary = texts[1] ? blockText(texts[1]) : ""
    }
    if (section.kind === "experience") {
      for (let i = 0; i < section.blocks.length; i += 1) {
        const block = section.blocks[i]
        if (!block || block.type !== "heading") continue
        const [role, company] = splitComma(block.text)
        let period = ""
        const bullets: string[] = []
        const next = section.blocks[i + 1]
        if (next && (next.type === "text" || next.type === "heading")) {
          period = blockText(next)
          i += 1
        }
        const listed = section.blocks[i + 1]
        if (
          listed &&
          (listed.type === "bulleted-list" || listed.type === "numbered-list")
        ) {
          bullets.push(...listed.items.map((item) => item.text))
          i += 1
        } else {
          while (
            section.blocks[i + 1] &&
            (section.blocks[i + 1]?.type === "text" ||
              section.blocks[i + 1]?.type === "heading")
          ) {
            const extra = section.blocks[i + 1]
            i += 1
            const line = blockText(extra)
            if (line) bullets.push(line)
          }
        }
        experience.push({ role, company, period, bullets })
      }
    }
    if (section.kind === "education") {
      for (let i = 0; i < section.blocks.length; i += 1) {
        const block = section.blocks[i]
        if (!block || block.type !== "heading") continue
        const [school, degree] = splitComma(block.text)
        let period = ""
        let detail: string | undefined
        const periodBlock = section.blocks[i + 1]
        if (
          periodBlock &&
          (periodBlock.type === "text" || periodBlock.type === "heading")
        ) {
          period = blockText(periodBlock)
          i += 1
        }
        const detailBlock = section.blocks[i + 1]
        if (
          detailBlock &&
          (detailBlock.type === "text" || detailBlock.type === "heading")
        ) {
          const value = blockText(detailBlock)
          if (value) detail = value
          i += 1
        }
        education.push(
          detail
            ? { school, degree, period, detail }
            : { school, degree, period }
        )
      }
    }
    if (section.kind === "skills") {
      const text = section.blocks
        .filter((block) => block.type === "text" || block.type === "heading")
        .map((block) => blockText(block))
        .find((value) => value.length > 0)
      const items = (text ?? "")
        .split(", ")
        .map((item) => item.trim())
        .filter(Boolean)
      if (items.length > 0) skills = [{ label: "Skills", items }]
    }
    if (section.kind === "projects") {
      for (let i = 0; i < section.blocks.length; i += 1) {
        const block = section.blocks[i]
        if (!block || block.type !== "heading") continue
        const detailBlock = section.blocks[i + 1]
        const detail =
          detailBlock &&
          (detailBlock.type === "text" || detailBlock.type === "heading")
            ? blockText(detailBlock)
            : ""
        if (detailBlock && detailBlock.type !== "heading") i += 1
        projects.push({ name: block.text, detail })
      }
    }
    if (section.kind === "languages") {
      const text = section.blocks
        .map((block) => blockText(block))
        .find((value) => value.length > 0)
      languages = (text ?? "")
        .split(", ")
        .map((item) => item.trim())
        .filter(Boolean)
    }
  }

  const codec: CvDocument = {
    templateId,
    name: document.header.name,
    headline,
    contact: {
      email: document.header.email,
      phone: document.header.phone,
      location: document.header.city,
    },
    summary,
    experience,
    education,
    skills,
  }
  if (document.header.linkedin)
    codec.contact.linkedin = document.header.linkedin
  if (projects.length > 0) codec.projects = projects
  if (languages.length > 0) codec.languages = languages
  if (document.header.photo) codec.photoUrl = document.header.photo
  return cvDocumentV1Schema.parse(codec)
}

export function blocksToPreviewModel(
  document: CvBlockDocument,
  templateId: CvTemplateId = "internship"
): CvDocument {
  const parsed = cvTemplateIdSchema.parse(templateId)
  return blocksToCvCodec(document, parsed)
}

function isBlankCodec(document: CvDocument) {
  return (
    document.name === "" &&
    document.headline === "" &&
    document.summary === "" &&
    document.contact.email === "" &&
    document.contact.phone === "" &&
    document.contact.location === "" &&
    !document.contact.linkedin &&
    !document.photoUrl &&
    document.experience.length === 0 &&
    document.education.length === 0 &&
    document.skills.length === 0 &&
    (document.projects?.length ?? 0) === 0 &&
    (document.languages?.length ?? 0) === 0
  )
}

/** Version 2 is edited as stored. A v1 codec maps on read. An empty v1 opens as the blank block document. */
export function readCvBlocks(document: unknown): CvBlockDocument | null {
  if (isCvBlockDocument(document)) return document
  if (!isCvDocument(document)) return null
  if (isBlankCodec(document)) return blankBlockDocument()
  return cvCodecToBlocks(document)
}

function collectedText(document: CvBlockDocument) {
  const parts = [
    document.header.name,
    document.header.email,
    document.header.phone,
    document.header.city,
    document.header.linkedin,
  ]
  for (const section of document.sections) {
    for (const block of section.blocks) parts.push(blockText(block))
  }
  return parts.join("\n")
}

function hasPhoneRun(text: string) {
  return /(?:\d[\s().+-]*){6}\d/.test(text)
}

export function findImportChecks(document: CvBlockDocument): CvImportCheck[] {
  const checks: CvImportCheck[] = []
  if (!document.header.phone.trim() && !hasPhoneRun(collectedText(document))) {
    checks.push({
      id: "phone",
      kind: "phone",
      blockId: "header.phone",
      message: IMPORT_PHONE_MESSAGE,
      resolved: false,
    })
  }
  const experience = document.sections.find(
    (section) => section.kind === "experience"
  )
  const headingIndex =
    experience?.blocks.findIndex((block) => block.type === "heading") ?? -1
  if (experience && headingIndex >= 0) {
    const heading = experience.blocks[headingIndex]
    const following = experience.blocks[headingIndex + 1]
    const period =
      following && (following.type === "text" || following.type === "heading")
        ? blockText(following)
        : ""
    if (!period.includes("20") && heading) {
      checks.push({
        id: "dates",
        kind: "dates",
        blockId: following?.id ?? heading.id,
        message: IMPORT_DATES_MESSAGE,
        resolved: false,
      })
    }
  }
  return checks
}

function hostIs(host: string, domain: string) {
  return host === domain || host.endsWith(`.${domain}`)
}

function linkHost(value: string) {
  const match = /^https?:\/\/([^/?#]+)/i.exec(value.trim())
  const host = match?.[1]?.replace(/:\d+$/, "").toLowerCase()
  return host || null
}

export function unreadableImportLink(value: string): string | null {
  const host = linkHost(value)
  if (!host) return null
  if (hostIs(host, "docs.google.com")) return IMPORT_GOOGLE_MESSAGE
  if (hostIs(host, "linkedin.com")) return IMPORT_LINKEDIN_MESSAGE
  return null
}

export function paragraphsToBlockDocument(text: string): CvBlockDocument {
  const id = makeIds()
  const paragraphs = text
    .split(/\n\s*\n|\n/)
    .map((part) => part.trim())
    .filter(Boolean)
  const blocks =
    paragraphs.length > 0
      ? paragraphs.map((paragraph) => textBlock(id, paragraph))
      : [textBlock(id, "")]
  return {
    version: 2,
    header: {
      name: "",
      email: "",
      phone: "",
      city: "",
      linkedin: "",
    },
    sections: [{ id: id(), kind: "summary", blocks }],
  }
}
