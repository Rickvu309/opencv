import type {
  CvDocument,
  CvEducation,
  CvExperience,
  CvProject,
  CvSkillGroup,
  CvTemplateId,
} from "../paper-codecs.js"
import type { CvBlockDocument, CvSectionKind } from "./document.js"
import { printBlock } from "./registry.js"
import type { PreviewFragment } from "./types.js"

export type CvPreviewModel = Omit<CvDocument, "projects" | "languages"> & {
  projects: NonNullable<CvDocument["projects"]>
  languages: string[]
  activities: string[]
  awards: string[]
}

function looseLines(fragment: PreviewFragment): string[] {
  if (fragment.kind === "text" || fragment.kind === "heading") {
    return fragment.text ? [fragment.text] : []
  }
  if (fragment.kind === "list" && !fragment.ordered) {
    return fragment.items.filter((item) => item.length > 0)
  }
  return []
}

function aside(fragment: PreviewFragment): boolean {
  return (
    fragment.kind === "divider" ||
    (fragment.kind === "list" && fragment.ordered)
  )
}

function visible(fragments: PreviewFragment[]): PreviewFragment[] {
  return fragments.filter((fragment) => !aside(fragment))
}

function readExperience(fragments: PreviewFragment[]): CvExperience[] {
  const experience: CvExperience[] = []
  let current: CvExperience | null = null
  for (const fragment of visible(fragments)) {
    if (fragment.kind === "experience") {
      current = {
        role: fragment.role,
        company: fragment.company,
        period: fragment.period,
        bullets: [...fragment.bullets],
        ...(fragment.location ? { location: fragment.location } : {}),
      }
      experience.push(current)
      continue
    }
    const lines = looseLines(fragment)
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

function readEducation(fragments: PreviewFragment[]): CvEducation[] {
  const education: CvEducation[] = []
  for (const fragment of visible(fragments)) {
    if (fragment.kind !== "education") continue
    const row: CvEducation = {
      school: fragment.school,
      degree: fragment.degree,
      period: fragment.period,
    }
    if (fragment.detail) row.detail = fragment.detail
    education.push(row)
  }
  return education
}

function readSkills(fragments: PreviewFragment[]): CvSkillGroup[] {
  const groups: CvSkillGroup[] = []
  for (const fragment of visible(fragments)) {
    if (fragment.kind === "skills") {
      if (fragment.label || fragment.items.length > 0) {
        groups.push({ label: fragment.label, items: [...fragment.items] })
      }
      continue
    }
    const text = looseLines(fragment).join("\n").trim()
    if (!text) continue
    const items = text
      .split(", ")
      .map((item) => item.trim())
      .filter(Boolean)
    if (items.length > 0) groups.push({ label: "Skills", items })
  }
  return groups
}

function appendDetail(detail: string, items: readonly string[]): string {
  const extra = items.filter((item) => item.length > 0).join("\n")
  if (extra.length === 0) return detail
  return detail.length === 0 ? extra : `${detail}\n${extra}`
}

/** First line is the name. Slash insert stores a project as one text block. */
function projectFromText(text: string): CvProject {
  const split = text.indexOf("\n")
  if (split === -1) return { name: text, detail: "" }
  return { name: text.slice(0, split), detail: text.slice(split + 1) }
}

function readProjects(fragments: PreviewFragment[]): CvProject[] {
  const projects: CvProject[] = []
  const blocks = visible(fragments)
  for (let index = 0; index < blocks.length; index += 1) {
    const fragment = blocks[index]
    if (!fragment) continue
    if (fragment.kind === "heading") {
      const next = blocks[index + 1]
      let detail = ""
      if (next?.kind === "text") {
        detail = next.text
        index += 1
      }
      projects.push({ name: fragment.text, detail })
      continue
    }
    if (fragment.kind === "text") {
      if (fragment.text.trim().length === 0) continue
      projects.push(projectFromText(fragment.text))
      continue
    }
    if (fragment.kind === "list") {
      const current = projects[projects.length - 1]
      if (!current) continue
      current.detail = appendDetail(current.detail, fragment.items)
    }
  }
  return projects
}

function readLanguages(fragments: PreviewFragment[]): string[] {
  const text = visible(fragments)
    .flatMap((fragment) => looseLines(fragment))
    .find((value) => value.trim().length > 0)
  return (text ?? "")
    .split(", ")
    .map((item) => item.trim())
    .filter(Boolean)
}

function readSummary(fragments: PreviewFragment[]): {
  headline: string
  summary: string
} {
  let headline = ""
  const parts: string[] = []
  for (const fragment of visible(fragments)) {
    if (fragment.kind === "heading" && !headline) {
      headline = fragment.text
      continue
    }
    parts.push(...looseLines(fragment))
  }
  return { headline, summary: parts.join("\n") }
}

function sectionFragments(
  document: CvBlockDocument,
  kind: CvSectionKind
): PreviewFragment[] {
  const fragments: PreviewFragment[] = []
  for (const section of document.sections) {
    if (section.kind !== kind) continue
    fragments.length = 0
    for (const block of section.blocks) fragments.push(printBlock(block))
  }
  return fragments
}

function lineList(document: CvBlockDocument, kind: CvSectionKind): string[] {
  const lines: string[] = []
  for (const section of document.sections) {
    if (section.kind !== kind) continue
    for (const block of section.blocks) {
      const fragment = printBlock(block)
      if (fragment.kind === "text" || fragment.kind === "heading") {
        if (fragment.text.trim()) lines.push(fragment.text)
        continue
      }
      if (fragment.kind === "list") {
        lines.push(...fragment.items.filter((item) => item.trim()))
        continue
      }
      if (fragment.kind === "experience") {
        lines.push(
          ...[
            fragment.role,
            fragment.company,
            fragment.period,
            fragment.location ?? "",
            ...fragment.bullets,
          ].filter((line) => line.trim())
        )
        continue
      }
      if (fragment.kind === "education") {
        lines.push(
          ...[
            fragment.school,
            fragment.degree,
            fragment.period,
            fragment.detail,
          ].filter((line) => line.trim())
        )
        continue
      }
      if (fragment.kind === "skills") {
        lines.push(
          ...[fragment.label, ...fragment.items].filter((line) => line.trim())
        )
      }
    }
  }
  return lines
}

/** Each block is drawn with its registry print(), then folded into the form fields. */
export function blocksToPreviewModel(
  document: CvBlockDocument,
  templateId: CvTemplateId = "internship"
): CvPreviewModel {
  const summary = readSummary(sectionFragments(document, "summary"))
  const preview: CvPreviewModel = {
    templateId,
    name: document.header.name,
    headline: summary.headline,
    contact: {
      email: document.header.email,
      phone: document.header.phone,
      location: document.header.city,
    },
    summary: summary.summary,
    experience: readExperience(sectionFragments(document, "experience")),
    education: readEducation(sectionFragments(document, "education")),
    skills: readSkills(sectionFragments(document, "skills")),
    projects: readProjects(sectionFragments(document, "projects")),
    languages: readLanguages(sectionFragments(document, "languages")),
    activities: lineList(document, "activities"),
    awards: lineList(document, "awards"),
  }
  if (document.header.linkedin)
    preview.contact.linkedin = document.header.linkedin
  if (document.header.photo) preview.photoUrl = document.header.photo
  return preview
}

/** The fields the current templates read. Activities and awards stay on the preview. */
export function previewToCvDocument(preview: CvPreviewModel): CvDocument {
  const document: CvDocument = {
    templateId: preview.templateId,
    name: preview.name,
    headline: preview.headline,
    contact: preview.contact,
    summary: preview.summary,
    experience: preview.experience,
    education: preview.education,
    skills: preview.skills,
  }
  if (preview.projects.length > 0) document.projects = preview.projects
  if (preview.languages.length > 0) document.languages = preview.languages
  if (preview.photoUrl) document.photoUrl = preview.photoUrl
  return document
}
