import {
  cvBlockDocumentSchema,
  type CvBlock as LegacyBlock,
  type CvBlockDocument,
} from "../paper-blocks/document.js"
import {
  isCvDocument,
  letterDocumentV1Schema,
  type CvDocument,
  type LetterDocument,
} from "../paper-codecs.js"
import type { PaperStoredKind } from "../paper.js"
import {
  blankCv,
  blankLetter,
  paperDocumentSchema,
  sectionMarker,
  type LetterPaper,
  type PaperDocument,
} from "./document.js"
import {
  HEADER_NODE_ID,
  type CvSectionKind,
  type ListItem,
  type NodeId,
} from "./nodes.js"
import { richTextOf } from "./rich-text.js"

export type StoredShape =
  "cv-v1" | "cv-v2" | "cv-v3" | "letter-markdown" | "letter-v3"

export type UpgradeRefusalReason = "unrecognized" | "wrong-kind" | "invalid"

export type Upgraded =
  | {
      readonly ok: true
      readonly document: PaperDocument
      readonly from: StoredShape
    }
  | {
      readonly ok: false
      readonly reason: UpgradeRefusalReason
      readonly message: string
    }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function refuse(reason: UpgradeRefusalReason, message: string): Upgraded {
  return { ok: false, reason, message }
}

function validated(candidate: unknown, from: StoredShape): Upgraded {
  const parsed = paperDocumentSchema.safeParse(candidate)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    const where = issue?.path.length ? ` at ${issue.path.join(".")}` : ""
    return refuse("invalid", `${issue?.message ?? "Invalid document"}${where}`)
  }
  return { ok: true, document: parsed.data, from }
}

const VALID_ID = /^[A-Za-z0-9_-]{1,64}$/

function idAllocator() {
  const used = new Set<string>([HEADER_NODE_ID])
  return (raw: string): NodeId => {
    if (VALID_ID.test(raw) && !used.has(raw)) {
      used.add(raw)
      return raw as NodeId
    }
    const base = raw.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 56) || "node"
    let id = base
    for (let attempt = 2; used.has(id); attempt += 1) id = `${base}-${attempt}`
    used.add(id)
    return id as NodeId
  }
}

function skillItemsOf(items: readonly string[]): string[] {
  return items.filter((item) => item.length > 0)
}

function cvFromBlockDocument(legacy: CvBlockDocument): unknown {
  const allocate = idAllocator()
  const itemsOf = (
    items: readonly { id: string; text: string }[],
    type: ListItem["type"]
  ) =>
    items.map((item) => ({
      id: allocate(item.id),
      type,
      content: richTextOf(item.text),
      children: [],
    }))
  const blockOf = (block: LegacyBlock): unknown[] => {
    switch (block.type) {
      case "text":
        return [
          {
            id: allocate(block.id),
            type: "paragraph",
            content: richTextOf(block.text),
          },
        ]
      case "heading":
        return [
          {
            id: allocate(block.id),
            type: "heading",
            level: 2,
            content: richTextOf(block.text),
          },
        ]
      case "bulleted-list":
        return itemsOf(block.items, "bullet")
      case "numbered-list":
        return itemsOf(block.items, "numbered")
      case "divider":
        return [{ id: allocate(block.id), type: "divider" }]
      case "experience-entry":
        return [
          {
            id: allocate(block.id),
            type: "experience",
            role: block.role,
            company: block.company,
            period: block.period,
            location: block.location ?? "",
            children: itemsOf(block.bullets, "bullet"),
          },
        ]
      case "education-entry":
        return [
          {
            id: allocate(block.id),
            type: "education",
            school: block.school,
            degree: block.degree,
            period: block.period,
            detail: block.detail,
            children: [],
          },
        ]
      case "skills-group":
        return [
          {
            id: allocate(block.id),
            type: "skills",
            label: block.label,
            items: skillItemsOf(block.items),
          },
        ]
    }
  }
  const blocks = legacy.sections.flatMap((section) => [
    sectionMarker(section.kind, allocate(section.id)),
    ...section.blocks.flatMap(blockOf),
  ])
  return {
    version: 3,
    kind: "cv",
    header: { id: HEADER_NODE_ID, type: "header", ...legacy.header },
    blocks,
    clashes: [],
  }
}

function paragraphsOfText(text: string): string[] {
  return text
    .replace(/\r\n?/g, "\n")
    .split(/\n(?:[ \t]*\n)+/)
    .map((paragraph) => paragraph.replace(/^\n+|\n+$/g, ""))
    .filter((paragraph) => paragraph.trim() !== "")
}

function letterFromStored(letter: LetterDocument): LetterPaper {
  const paragraphs = [
    letter.sender,
    letter.contact,
    letter.date,
    letter.recipient,
    letter.salutation,
    letter.markdown,
    letter.closing,
    letter.signature,
  ].flatMap((text) => paragraphsOfText(text ?? ""))
  if (paragraphs.length === 0) return blankLetter()
  return {
    version: 3,
    kind: "letter",
    blocks: paragraphs.map((text, index) => ({
      id: `l-${index + 1}` as NodeId,
      type: "paragraph",
      content: richTextOf(text),
    })),
    clashes: [],
  }
}

function cvFromV1(legacy: CvDocument): unknown {
  const allocate = idAllocator()
  const bulletsOf = (texts: readonly string[]) =>
    texts.map((text) => ({
      id: allocate("bullet"),
      type: "bullet",
      content: richTextOf(text),
      children: [],
    }))
  const paragraphOf = (text: string) => ({
    id: allocate("text"),
    type: "paragraph",
    content: richTextOf(text),
  })
  const sections: { kind: CvSectionKind; blocks: unknown[] }[] = []
  const summary: unknown[] = []
  if (legacy.headline.trim() !== "") {
    summary.push({
      id: allocate("headline"),
      type: "heading",
      level: 2,
      content: richTextOf(legacy.headline),
    })
  }
  if (legacy.summary.trim() !== "") summary.push(paragraphOf(legacy.summary))
  if (summary.length > 0) sections.push({ kind: "summary", blocks: summary })
  if (legacy.experience.length > 0) {
    sections.push({
      kind: "experience",
      blocks: legacy.experience.map((role) => ({
        id: allocate("experience"),
        type: "experience",
        role: role.role,
        company: role.company,
        period: role.period,
        location: role.location ?? "",
        children: bulletsOf(role.bullets),
      })),
    })
  }
  if (legacy.education.length > 0) {
    sections.push({
      kind: "education",
      blocks: legacy.education.map((school) => ({
        id: allocate("education"),
        type: "education",
        school: school.school,
        degree: school.degree,
        period: school.period,
        detail: school.detail ?? "",
        children: [],
      })),
    })
  }
  if (legacy.skills.length > 0) {
    sections.push({
      kind: "skills",
      blocks: legacy.skills.map((group) => ({
        id: allocate("skills"),
        type: "skills",
        label: group.label,
        items: skillItemsOf(group.items),
      })),
    })
  }
  const projects = legacy.projects ?? []
  if (projects.length > 0) {
    sections.push({
      kind: "projects",
      blocks: projects.flatMap((project) => [
        {
          id: allocate("project"),
          type: "heading",
          level: 2,
          content: richTextOf(project.name),
        },
        ...(project.detail === "" ? [] : [paragraphOf(project.detail)]),
      ]),
    })
  }
  const languages = (legacy.languages ?? []).filter((item) => item !== "")
  if (languages.length > 0) {
    sections.push({
      kind: "languages",
      blocks: [paragraphOf(languages.join(", "))],
    })
  }
  const header = {
    id: HEADER_NODE_ID,
    type: "header",
    name: legacy.name,
    email: legacy.contact.email,
    phone: legacy.contact.phone,
    city: legacy.contact.location,
    linkedin: legacy.contact.linkedin ?? "",
    ...(legacy.photoUrl ? { photo: legacy.photoUrl } : {}),
  }
  const blank =
    sections.length === 0 &&
    [
      header.name,
      header.email,
      header.phone,
      header.city,
      header.linkedin,
    ].every((value) => value === "") &&
    !legacy.photoUrl
  if (blank) return blankCv()
  return {
    version: 3,
    kind: "cv",
    header,
    blocks: sections.flatMap((section) => [
      sectionMarker(section.kind, allocate(`section-${section.kind}`)),
      ...section.blocks,
    ]),
    clashes: [],
  }
}

export function upgradeStoredPaper(
  kind: PaperStoredKind,
  stored: unknown
): Upgraded {
  if (isRecord(stored) && stored.version === 3) {
    const result = validated(stored, kind === "cv" ? "cv-v3" : "letter-v3")
    if (result.ok && result.document.kind !== kind) {
      return refuse(
        "wrong-kind",
        `A ${kind} row holds a ${result.document.kind}`
      )
    }
    return result
  }
  if (kind === "letter") {
    const letter = letterDocumentV1Schema.safeParse(stored)
    if (!letter.success) {
      return refuse("unrecognized", "Not a letter this version can read")
    }
    return validated(letterFromStored(letter.data), "letter-markdown")
  }
  const legacy = cvBlockDocumentSchema.safeParse(stored)
  if (legacy.success)
    return validated(cvFromBlockDocument(legacy.data), "cv-v2")
  if (isCvDocument(stored)) return validated(cvFromV1(stored), "cv-v1")
  return refuse("unrecognized", "Not a CV this version can read")
}
