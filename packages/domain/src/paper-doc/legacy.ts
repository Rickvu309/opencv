import {
  cvBlockDocumentSchema,
  type CvBlock as LegacyBlock,
  type CvBlockDocument,
} from "../paper-blocks/document.js"
import { letterDocumentV1Schema, type LetterDocument } from "../paper-codecs.js"
import type { CvPaper, LetterPaper, PaperDocument } from "./document.js"
import type { CvPaperBlock, ListItem } from "./nodes.js"
import { plainTextOfRuns } from "./rich-text.js"
import { upgradeStoredPaper } from "./upgrade.js"

type LegacyItem = { id: string; text: string }
type LegacySection = CvBlockDocument["sections"][number]

function sortedJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(sortedJson).join(",")}]`
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>
    const body = Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${sortedJson(record[key])}`)
      .join(",")
    return `{${body}}`
  }
  return JSON.stringify(value) ?? "null"
}

function itemsInOrder(items: readonly ListItem[]): LegacyItem[] {
  return items.flatMap((item) => [
    { id: item.id, text: plainTextOfRuns(item.content) },
    ...itemsInOrder(item.children),
  ])
}

function allIds(paper: CvPaper): Set<string> {
  const ids = new Set<string>()
  const visit = (items: readonly ListItem[]) => {
    for (const item of items) {
      ids.add(item.id)
      visit(item.children)
    }
  }
  ids.add(paper.header.id)
  for (const block of paper.blocks) {
    ids.add(block.id)
    if ("children" in block) visit(block.children)
  }
  return ids
}

function cvSections(paper: CvPaper): LegacySection[] {
  const taken = allIds(paper)
  const sections: LegacySection[] = []
  let open: LegacySection | null = null
  const sectionForBlock = () => {
    if (open) return open
    let id = "section-leading"
    for (let attempt = 2; taken.has(id); attempt += 1) {
      id = `section-leading-${attempt}`
    }
    open = { id, kind: "summary", blocks: [] }
    sections.push(open)
    return open
  }
  const push = (block: LegacyBlock) => {
    const blocks = sectionForBlock().blocks
    const last = blocks[blocks.length - 1]
    if (
      (block.type === "bulleted-list" || block.type === "numbered-list") &&
      last?.type === block.type &&
      "items" in last
    ) {
      last.items.push(...block.items)
      return
    }
    blocks.push(block)
  }
  const listOf = (
    type: "bulleted-list" | "numbered-list",
    item: ListItem
  ): LegacyBlock => ({
    id: `${item.id}-list`,
    type,
    items: itemsInOrder([item]),
  })
  const blockOf = (block: CvPaperBlock): void => {
    switch (block.type) {
      case "section":
        open = { id: block.id, kind: block.kind, blocks: [] }
        sections.push(open)
        return
      case "paragraph":
        push({
          id: block.id,
          type: "text",
          text: plainTextOfRuns(block.content),
        })
        return
      case "heading":
        push({
          id: block.id,
          type: "heading",
          text: plainTextOfRuns(block.content),
        })
        return
      case "bullet":
        push(listOf("bulleted-list", block))
        return
      case "numbered":
        push(listOf("numbered-list", block))
        return
      case "divider":
        push({ id: block.id, type: "divider" })
        return
      case "experience":
        push({
          id: block.id,
          type: "experience-entry",
          role: block.role,
          company: block.company,
          period: block.period,
          ...(block.location === "" ? {} : { location: block.location }),
          bullets: itemsInOrder(block.children),
        })
        return
      case "education":
        push({
          id: block.id,
          type: "education-entry",
          school: block.school,
          degree: block.degree,
          period: block.period,
          detail: [
            block.detail,
            ...itemsInOrder(block.children).map((item) => item.text),
          ]
            .filter((part) => part !== "")
            .join("\n"),
        })
        return
      case "skills":
        push({
          id: block.id,
          type: "skills-group",
          label: block.label,
          items: [...block.items],
        })
    }
  }
  paper.blocks.forEach(blockOf)
  return sections
}

function cvLegacy(paper: CvPaper): CvBlockDocument {
  const { id: _id, type: _type, ...header } = paper.header
  void _id
  void _type
  return { version: 2, header, sections: cvSections(paper) }
}

function letterLegacy(paper: LetterPaper): LetterDocument {
  const texts = paper.blocks.flatMap((block) => {
    switch (block.type) {
      case "paragraph":
      case "heading":
        return [plainTextOfRuns(block.content)]
      case "bullet":
      case "numbered":
        return itemsInOrder([block]).map((item) => item.text)
      case "divider":
        return []
    }
  })
  return { markdown: texts.filter((text) => text.trim() !== "").join("\n\n") }
}

function witnessFor(paper: PaperDocument, witness: unknown) {
  const shape =
    paper.kind === "cv"
      ? cvBlockDocumentSchema.safeParse(witness)
      : letterDocumentV1Schema.safeParse(witness)
  if (!shape.success) return null
  const upgraded = upgradeStoredPaper(paper.kind, shape.data)
  if (!upgraded.ok) return null
  return sortedJson(upgraded.document) === sortedJson(paper) ? shape.data : null
}

export function legacyPaperOf(
  paper: PaperDocument,
  witness?: unknown
): CvBlockDocument | LetterDocument {
  const same = witness === undefined ? null : witnessFor(paper, witness)
  if (same) return same
  return paper.kind === "cv" ? cvLegacy(paper) : letterLegacy(paper)
}
