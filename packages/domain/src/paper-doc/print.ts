import {
  sectionMarker,
  sectionsOf,
  type CvPaper,
  type LetterPaper,
} from "./document.js"
import {
  type CvPaperBlock,
  type CvSectionKind,
  type CvSectionMarker,
  type ListItem,
  type NodeId,
} from "./nodes.js"
import { plainTextOfRuns, type RichText } from "./rich-text.js"

export type CvTemplateId =
  "internship" | "product" | "service" | "academic" | "photo"

export type CvContact = {
  email: string
  phone: string
  location: string
  linkedin?: string
}

export type CvEducation = {
  school: string
  degree: string
  period: string
  detail?: string
}

export type CvExperience = {
  role: string
  company: string
  period: string
  location?: string
  bullets: string[]
}

export type CvSkillGroup = {
  label: string
  items: string[]
}

export type CvProject = {
  name: string
  detail: string
}

export type CvDocument = {
  templateId: CvTemplateId
  name: string
  headline: string
  contact: CvContact
  summary: string
  experience: CvExperience[]
  education: CvEducation[]
  skills: CvSkillGroup[]
  projects?: CvProject[]
  languages?: string[]
  photoUrl?: string
}

export type CvPrintModel = Omit<CvDocument, "projects" | "languages"> & {
  projects: NonNullable<CvDocument["projects"]>
  languages: string[]
  activities: string[]
  awards: string[]
  sectionTitles?: Partial<Record<CvSectionKind, string>>
}

export type LetterPrintList = {
  readonly ordered: boolean
  readonly items: readonly LetterPrintItem[]
}

type LetterPrintItem = {
  readonly text: RichText
  readonly lists: readonly LetterPrintList[]
}

type LetterFragment =
  | { readonly kind: "text"; readonly node: NodeId; readonly text: RichText }
  | {
      readonly kind: "heading"
      readonly node: NodeId
      readonly level: 2 | 3
      readonly text: RichText
    }
  | { readonly kind: "list"; readonly list: LetterPrintList }
  | { readonly kind: "divider"; readonly node: NodeId }

type LetterPrintModel = { readonly fragments: readonly LetterFragment[] }

type Fragment =
  | { kind: "text"; text: string }
  | { kind: "heading"; text: string }
  | { kind: "list"; ordered: boolean; items: string[] }
  | { kind: "divider" }
  | {
      kind: "experience"
      role: string
      company: string
      period: string
      location: string
      bullets: string[]
    }
  | {
      kind: "education"
      school: string
      degree: string
      period: string
      detail: string
    }
  | { kind: "skills"; label: string; items: string[] }

type BodyBlock = Exclude<CvPaperBlock, CvSectionMarker>

function flatItems(items: readonly ListItem[]): string[] {
  return items.flatMap((item) => [
    plainTextOfRuns(item.content),
    ...flatItems(item.children),
  ])
}

function fragmentsOf(blocks: readonly BodyBlock[]): Fragment[] {
  const fragments: Fragment[] = []
  for (const block of blocks) {
    switch (block.type) {
      case "paragraph":
        fragments.push({ kind: "text", text: plainTextOfRuns(block.content) })
        break
      case "heading":
        fragments.push({
          kind: "heading",
          text: plainTextOfRuns(block.content),
        })
        break
      case "bullet":
      case "numbered": {
        const ordered = block.type === "numbered"
        const items = flatItems([block])
        const last = fragments[fragments.length - 1]
        if (last?.kind === "list" && last.ordered === ordered) {
          last.items.push(...items)
        } else {
          fragments.push({ kind: "list", ordered, items })
        }
        break
      }
      case "divider":
        fragments.push({ kind: "divider" })
        break
      case "experience":
        fragments.push({
          kind: "experience",
          role: block.role,
          company: block.company,
          period: block.period,
          location: block.location,
          bullets: flatItems(block.children),
        })
        break
      case "education":
        fragments.push({
          kind: "education",
          school: block.school,
          degree: block.degree,
          period: block.period,
          detail: block.detail,
        })
        break
      case "skills":
        fragments.push({
          kind: "skills",
          label: block.label,
          items: [...block.items],
        })
        break
    }
  }
  return fragments
}

function looseLines(fragment: Fragment): string[] {
  if (fragment.kind === "text" || fragment.kind === "heading") {
    return fragment.text ? [fragment.text] : []
  }
  if (fragment.kind === "list" && !fragment.ordered) {
    return fragment.items.filter((item) => item.length > 0)
  }
  return []
}

function visible(fragments: Fragment[]): Fragment[] {
  return fragments.filter(
    (fragment) =>
      fragment.kind !== "divider" &&
      !(fragment.kind === "list" && fragment.ordered)
  )
}

function readExperience(fragments: Fragment[]): CvExperience[] {
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

function readEducation(fragments: Fragment[]): CvEducation[] {
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

function readSkills(fragments: Fragment[]): CvSkillGroup[] {
  const groups: CvSkillGroup[] = []
  for (const fragment of visible(fragments)) {
    if (fragment.kind === "skills") {
      if (fragment.label || fragment.items.length > 0) {
        groups.push({ label: fragment.label, items: [...fragment.items] })
      }
      continue
    }
    const items = looseLines(fragment)
      .flatMap((line) => line.split(", "))
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

function projectFromText(text: string): CvProject {
  const split = text.indexOf("\n")
  if (split === -1) return { name: text, detail: "" }
  return { name: text.slice(0, split), detail: text.slice(split + 1) }
}

function readProjects(fragments: Fragment[]): CvProject[] {
  const projects: CvProject[] = []
  const shown = visible(fragments)
  for (let index = 0; index < shown.length; index += 1) {
    const fragment = shown[index]
    if (!fragment) continue
    if (fragment.kind === "heading") {
      const next = shown[index + 1]
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

function readLanguages(fragments: Fragment[]): string[] {
  const text = visible(fragments)
    .flatMap((fragment) => looseLines(fragment))
    .find((value) => value.trim().length > 0)
  return (text ?? "")
    .split(", ")
    .map((item) => item.trim())
    .filter(Boolean)
}

function readSummary(fragments: Fragment[]): {
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

function lineList(fragments: Fragment[]): string[] {
  const lines: string[] = []
  for (const fragment of fragments) {
    if (fragment.kind === "text" || fragment.kind === "heading") {
      if (fragment.text.trim()) lines.push(fragment.text)
    } else if (fragment.kind === "list") {
      lines.push(...fragment.items.filter((item) => item.trim()))
    } else if (fragment.kind === "experience") {
      lines.push(
        ...[
          fragment.role,
          fragment.company,
          fragment.period,
          fragment.location,
          ...fragment.bullets,
        ].filter((line) => line.trim())
      )
    } else if (fragment.kind === "education") {
      lines.push(
        ...[
          fragment.school,
          fragment.degree,
          fragment.period,
          fragment.detail,
        ].filter((line) => line.trim())
      )
    } else if (fragment.kind === "skills") {
      lines.push(
        ...[fragment.label, ...fragment.items].filter((line) => line.trim())
      )
    }
  }
  return lines
}

export function cvPrintModel(
  document: CvPaper,
  templateId: CvTemplateId = "internship"
): CvPrintModel {
  const groups = sectionsOf(document)
  const fragmentsFor = (kind: CvSectionKind): Fragment[] =>
    fragmentsOf(
      groups
        .filter(
          (group) =>
            group.section?.kind === kind ||
            (kind === "summary" && group.section === null)
        )
        .flatMap((group) => group.blocks)
    )
  const summary = readSummary(fragmentsFor("summary"))
  const { header } = document
  const preview: CvPrintModel = {
    templateId,
    name: header?.name ?? "",
    headline: summary.headline,
    contact: {
      email: header?.email ?? "",
      phone: header?.phone ?? "",
      location: header?.city ?? "",
    },
    summary: summary.summary,
    experience: readExperience(fragmentsFor("experience")),
    education: readEducation(fragmentsFor("education")),
    skills: readSkills(fragmentsFor("skills")),
    projects: readProjects(fragmentsFor("projects")),
    languages: readLanguages(fragmentsFor("languages")),
    activities: lineList(fragmentsFor("activities")),
    awards: lineList(fragmentsFor("awards")),
  }
  if (header?.linkedin) preview.contact.linkedin = header.linkedin
  if (header?.photo) preview.photoUrl = header.photo
  const sectionTitles = customSectionTitles(document)
  if (sectionTitles) preview.sectionTitles = sectionTitles
  return preview
}

function customSectionTitles(
  document: CvPaper
): Partial<Record<CvSectionKind, string>> | undefined {
  const titles: Partial<Record<CvSectionKind, string>> = {}
  const seen = new Set<CvSectionKind>()
  for (const block of document.blocks) {
    if (block.type !== "section" || seen.has(block.kind)) continue
    seen.add(block.kind)
    if (block.title === sectionMarker(block.kind, block.id).title) continue
    titles[block.kind] = block.title
  }
  return Object.keys(titles).length === 0 ? undefined : titles
}

function printItems(items: readonly ListItem[]): LetterPrintList[] {
  const lists: { ordered: boolean; items: LetterPrintItem[] }[] = []
  for (const item of items) {
    const ordered = item.type === "numbered"
    let list = lists[lists.length - 1]
    if (!list || list.ordered !== ordered) {
      list = { ordered, items: [] }
      lists.push(list)
    }
    list.items.push({ text: item.content, lists: printItems(item.children) })
  }
  return lists
}

export function letterPrintModel(document: LetterPaper): LetterPrintModel {
  const fragments: LetterFragment[] = []
  for (const block of document.blocks) {
    switch (block.type) {
      case "paragraph":
        fragments.push({ kind: "text", node: block.id, text: block.content })
        break
      case "heading":
        fragments.push({
          kind: "heading",
          node: block.id,
          level: block.level,
          text: block.content,
        })
        break
      case "divider":
        fragments.push({ kind: "divider", node: block.id })
        break
      case "bullet":
      case "numbered": {
        const [list] = printItems([block])
        const last = fragments[fragments.length - 1]
        if (
          last?.kind === "list" &&
          list &&
          last.list.ordered === list.ordered
        ) {
          fragments[fragments.length - 1] = {
            kind: "list",
            list: {
              ordered: list.ordered,
              items: [...last.list.items, ...list.items],
            },
          }
        } else if (list) {
          fragments.push({ kind: "list", list })
        }
        break
      }
    }
  }
  return { fragments }
}
