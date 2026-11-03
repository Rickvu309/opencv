import {
  cvDocumentV1Schema,
  isCvDocument,
  type CvDocument,
  type CvEducation,
  type CvExperience,
  type CvProject,
  type CvSkillGroup,
  type CvTemplateId,
} from "../paper-codecs.js"
import {
  blankBlockDocument,
  isCvBlockDocument,
  makeIds,
  type CvBlock,
  type CvBlockDocument,
} from "./document.js"
import { plainTextOf, printBlock } from "./registry.js"
import type { PreviewFragment } from "./types.js"

export function cvCodecToBlocks(document: CvDocument): CvBlockDocument {
  const id = makeIds()
  const sections: CvBlockDocument["sections"] = []
  const summaryBlocks: CvBlock[] = []
  if (document.headline.trim()) {
    summaryBlocks.push({
      id: id(),
      type: "heading",
      text: document.headline,
    })
  }
  if (document.summary.trim() && document.summary !== document.headline) {
    summaryBlocks.push({ id: id(), type: "text", text: document.summary })
  }
  if (summaryBlocks.length > 0) {
    sections.push({ id: id(), kind: "summary", blocks: summaryBlocks })
  }
  if (document.experience.length > 0) {
    sections.push({
      id: id(),
      kind: "experience",
      blocks: document.experience.map((role) => ({
        id: id(),
        type: "experience-entry" as const,
        role: role.role,
        company: role.company,
        period: role.period,
        ...(role.location ? { location: role.location } : {}),
        bullets: role.bullets.map((text) => ({ id: id(), text })),
      })),
    })
  }
  if (document.education.length > 0) {
    sections.push({
      id: id(),
      kind: "education",
      blocks: document.education.map((school) => ({
        id: id(),
        type: "education-entry" as const,
        school: school.school,
        degree: school.degree,
        period: school.period,
        detail: school.detail ?? "",
      })),
    })
  }
  if (document.skills.length > 0) {
    const label = document.skills[0]?.label ?? ""
    sections.push({
      id: id(),
      kind: "skills",
      blocks: [
        {
          id: id(),
          type: "skills-group" as const,
          label,
          items: document.skills.flatMap((group) => group.items),
        },
      ],
    })
  }
  const projects = document.projects ?? []
  if (projects.length > 0) {
    const blocks: CvBlock[] = []
    for (const project of projects) {
      blocks.push({ id: id(), type: "heading", text: project.name })
      blocks.push({ id: id(), type: "text", text: project.detail })
    }
    sections.push({ id: id(), kind: "projects", blocks })
  }
  const languages = document.languages ?? []
  if (languages.length > 0) {
    sections.push({
      id: id(),
      kind: "languages",
      blocks: [{ id: id(), type: "text", text: languages.join(", ") }],
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

function isAside(block: CvBlock): boolean {
  return block.type === "divider" || block.type === "numbered-list"
}

function linesOf(fragment: PreviewFragment): string[] {
  if (fragment.kind === "text" || fragment.kind === "heading") {
    return fragment.text ? [fragment.text] : []
  }
  if (fragment.kind === "list" && !fragment.ordered) {
    return fragment.items.filter((item) => item.length > 0)
  }
  return []
}

function readExperience(blocks: CvBlock[]): CvExperience[] {
  const experience: CvExperience[] = []
  let current: CvExperience | null = null
  for (const block of blocks) {
    if (block.type === "experience-entry") {
      const printed = printBlock(block)
      if (printed.kind !== "experience") continue
      current = {
        role: printed.role,
        company: printed.company,
        period: printed.period,
        bullets: [...printed.bullets],
        ...(printed.location ? { location: printed.location } : {}),
      }
      experience.push(current)
      continue
    }
    const lines = linesOf(printBlock(block))
    if (lines.length === 0) continue
    if (!current) {
      current = {
        role: lines[0] ?? "",
        company: "",
        period: "",
        bullets: lines.slice(1),
      }
      experience.push(current)
      continue
    }
    current.bullets.push(...lines)
  }
  return experience
}

function readEducation(blocks: CvBlock[]): CvEducation[] {
  const education: CvEducation[] = []
  for (const block of blocks) {
    if (block.type !== "education-entry") continue
    const printed = printBlock(block)
    if (printed.kind !== "education") continue
    const row: CvEducation = {
      school: printed.school,
      degree: printed.degree,
      period: printed.period,
    }
    if (printed.detail) row.detail = printed.detail
    education.push(row)
  }
  return education
}

function readSkills(blocks: CvBlock[]): CvSkillGroup[] {
  const groups: CvSkillGroup[] = []
  for (const block of blocks) {
    if (block.type === "skills-group") {
      const printed = printBlock(block)
      if (
        printed.kind === "skills" &&
        (printed.label || printed.items.length > 0)
      ) {
        groups.push({ label: printed.label, items: [...printed.items] })
      }
      continue
    }
    const text = plainTextOf(block).trim()
    if (!text) continue
    const items = text
      .split(", ")
      .map((item) => item.trim())
      .filter(Boolean)
    if (items.length > 0) groups.push({ label: "Skills", items })
  }
  return groups
}

function readProjects(blocks: CvBlock[]): CvProject[] {
  const projects: CvProject[] = []
  for (let index = 0; index < blocks.length; index += 1) {
    const block = blocks[index]
    if (!block || block.type !== "heading") continue
    const next = blocks[index + 1]
    let detail = ""
    if (next?.type === "text") {
      detail = next.text
      index += 1
    }
    projects.push({ name: block.text, detail })
  }
  return projects
}

function readLanguages(blocks: CvBlock[]): string[] {
  const text = blocks
    .map((block) => plainTextOf(block))
    .find((value) => value.trim().length > 0)
  return (text ?? "")
    .split(", ")
    .map((item) => item.trim())
    .filter(Boolean)
}

function readSummary(blocks: CvBlock[]): { headline: string; summary: string } {
  let headline = ""
  const parts: string[] = []
  for (const block of blocks) {
    if (block.type === "heading" && !headline) {
      headline = block.text
      continue
    }
    parts.push(...linesOf(printBlock(block)))
  }
  return { headline, summary: parts.join("\n") }
}

export function blocksToCvCodec(
  document: CvBlockDocument,
  templateId: CvTemplateId = "internship"
): CvDocument {
  let headline = ""
  let summary = ""
  let experience: CvExperience[] = []
  let education: CvEducation[] = []
  let skills: CvSkillGroup[] = []
  let projects: CvProject[] = []
  let languages: string[] = []

  for (const section of document.sections) {
    const blocks = section.blocks.filter((block) => !isAside(block))
    if (section.kind === "summary") {
      const read = readSummary(blocks)
      headline = read.headline
      summary = read.summary
    } else if (section.kind === "experience") {
      experience = readExperience(blocks)
    } else if (section.kind === "education") {
      education = readEducation(blocks)
    } else if (section.kind === "skills") {
      skills = readSkills(blocks)
    } else if (section.kind === "projects") {
      projects = readProjects(blocks)
    } else if (section.kind === "languages") {
      languages = readLanguages(blocks)
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

export function readCvBlocks(document: unknown): CvBlockDocument | null {
  if (isCvBlockDocument(document)) return document
  if (!isCvDocument(document)) return null
  if (isBlankCodec(document)) return blankBlockDocument()
  return cvCodecToBlocks(document)
}
