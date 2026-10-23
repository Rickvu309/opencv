import {
  PAPER_KIND_LABEL,
  decodePaperContent,
  isCvDocument,
  isLetterDocument,
  isProofDocument,
  type CoachFocusDoc,
} from "@workspace/domain"

const LINE_CAP = 160

export function toCoachFocusDoc(row: {
  id: string
  name: string
  contentKind: CoachFocusDoc["kind"]
  status: CoachFocusDoc["status"]
  content: unknown
  contentVersion: number
}): CoachFocusDoc {
  return {
    id: row.id,
    name: row.name,
    kind: row.contentKind,
    status: row.status,
    content: row.content,
    contentVersion: row.contentVersion,
  }
}

export function describeFocusDoc(doc: CoachFocusDoc): string {
  const lines = [
    `Open Paper document: ${doc.name} · ${PAPER_KIND_LABEL[doc.kind]} · ${doc.status} (id: ${doc.id}). contentVersion: ${doc.contentVersion}.`,
    "Do not call paper_getDoc — the current JSON is below. To change it, run paper_updateContent with this docId, contentVersion, and the full updated JSON — never claim a silent rewrite, never ask the User to paste the rewrite, and never ask whether to apply.",
  ]

  const decoded = decodePaperContent(doc.kind, doc.contentVersion, doc.content)
  if (decoded.ok) {
    const outline = outlinePaperContent(decoded.data)
    if (outline.length > 0) {
      lines.push(
        "Section outline (use this when the User names a section or bullet and there is no selection):"
      )
      lines.push(...outline)
    }
  }

  lines.push(
    "Current content JSON (copy this object, change only the asked fields, send it as paper_updateContent.content):"
  )
  lines.push(JSON.stringify(doc.content))
  return lines.join("\n")
}

function outlinePaperContent(content: unknown): string[] {
  if (isCvDocument(content)) {
    const lines = [`- Summary: ${clip(content.summary)}`]
    content.experience.forEach((role, index) => {
      lines.push(
        `- Experience[${index}] ${role.role} · ${role.company}${
          role.location ? ` · ${role.location}` : ""
        }`
      )
      for (const bullet of role.bullets) {
        lines.push(`  - ${clip(bullet)}`)
      }
    })
    content.education.forEach((row, index) => {
      lines.push(
        `- Education[${index}] ${row.degree} · ${row.school}${
          row.period ? ` · ${row.period}` : ""
        }`
      )
      if (row.detail) lines.push(`  - ${clip(row.detail)}`)
    })
    content.skills.forEach((group, index) => {
      lines.push(
        `- Skills[${index}] ${group.label}: ${clip(group.items.join(", "))}`
      )
    })
    content.projects?.forEach((project, index) => {
      lines.push(
        `- Projects[${index}] ${project.name}: ${clip(project.detail)}`
      )
    })
    if (content.headline) {
      lines.push(`- Headline: ${clip(content.headline)}`)
    }
    if (content.languages && content.languages.length > 0) {
      lines.push(`- Languages: ${clip(content.languages.join(", "))}`)
    }
    return lines
  }
  if (isLetterDocument(content)) {
    return [`- Letter: ${clip(content.markdown, 240)}`]
  }
  if (isProofDocument(content)) {
    return [
      `- Proof: ${clip(content.title)}`,
      ...content.steps.map(
        (step) => `- ${step.type} · ${clip(step.title)}: ${clip(step.body)}`
      ),
    ]
  }
  return []
}

function clip(text: string, cap = LINE_CAP): string {
  const trimmed = text.replace(/\s+/g, " ").trim()
  if (trimmed.length <= cap) return trimmed
  return `${trimmed.slice(0, cap - 1).trimEnd()}…`
}

const EXPERIENCE_OR_BULLET = /\bexperience\b|\bbullet\b/i

const OTHER_CV_SECTIONS = [
  { name: "Education", pattern: /\beducation\b/i },
  { name: "Skills", pattern: /\bskills\b/i },
  { name: "Projects", pattern: /\bprojects\b/i },
  { name: "Headline", pattern: /\bheadline\b/i },
  { name: "Contact", pattern: /\bcontact\b/i },
  { name: "Languages", pattern: /\blanguages\b/i },
] as const

export type OtherCvSectionName = (typeof OTHER_CV_SECTIONS)[number]["name"]

export function namesExperienceOrBullet(userText: string): boolean {
  return EXPERIENCE_OR_BULLET.test(userText)
}

/** A real CV section that is not Summary or Experience — do not fall through to Summary. */
export function namedOtherCvSection(
  userText: string
): OtherCvSectionName | null {
  for (const section of OTHER_CV_SECTIONS) {
    if (section.pattern.test(userText)) return section.name
  }
  return null
}

/** Role labels already on the CV — used when an Experience ask cannot target a bullet. */
export function describeExperienceRoles(doc: CoachFocusDoc): string[] {
  const decoded = decodePaperContent(doc.kind, doc.contentVersion, doc.content)
  if (!decoded.ok || !isCvDocument(decoded.data)) return []
  return decoded.data.experience.map((role) =>
    role.location
      ? `${role.role} · ${role.company} · ${role.location}`
      : `${role.role} · ${role.company}`
  )
}
