import type { PaperEditorBlock, PaperPartialBlock } from "./schema.js"
import {
  HEADER_NODE_ID,
  normalizeRuns,
  paperDocumentSchema,
  plainTextOfRuns,
  type CvPaperBlock,
  type ListItem,
  type PaperDocument,
  type RichText,
  type TextRun,
} from "@workspace/domain"

type InlineText = {
  type: "text"
  text: string
  styles: { bold?: true; italic?: true }
}
type InlineLink = { type: "link"; href: string; content: InlineText[] }
type InlineItem = InlineText | InlineLink
type EditorBlockLike = PaperEditorBlock | PaperPartialBlock

export type PaperRefusal = { readonly ok: false; readonly reason: string }
export type PaperResult =
  { readonly ok: true; readonly document: PaperDocument } | PaperRefusal

function styled(run: TextRun): InlineText {
  return {
    type: "text",
    text: run.text,
    styles: {
      ...(run.bold ? { bold: true as const } : {}),
      ...(run.italic ? { italic: true as const } : {}),
    },
  }
}

function inlineOf(text: RichText): InlineItem[] {
  const items: InlineItem[] = []
  for (const run of text) {
    const last = items[items.length - 1]
    if (!run.href) {
      items.push(styled(run))
    } else if (last?.type === "link" && last.href === run.href) {
      last.content.push(styled(run))
    } else {
      items.push({ type: "link", href: run.href, content: [styled(run)] })
    }
  }
  return items
}

function plainInline(text: string): InlineItem[] {
  return text === "" ? [] : [{ type: "text", text, styles: {} }]
}

function runsOf(content: unknown): TextRun[] {
  if (!Array.isArray(content)) return []
  const runs: TextRun[] = []
  for (const item of content as InlineItem[]) {
    if (item.type === "link") {
      for (const part of item.content) {
        runs.push({ ...runFields(part), href: item.href as TextRun["href"] })
      }
    } else {
      runs.push(runFields(item))
    }
  }
  return runs
}

function runFields(item: InlineText): TextRun {
  return {
    text: item.text,
    ...(item.styles.bold ? { bold: true as const } : {}),
    ...(item.styles.italic ? { italic: true as const } : {}),
  }
}

function listItemBlock(item: ListItem): PaperPartialBlock {
  return {
    id: item.id,
    type: item.type === "bullet" ? "bulletListItem" : "numberedListItem",
    content: inlineOf(item.content),
    children: item.children.map(listItemBlock),
  }
}

function proseBlock(block: CvPaperBlock): PaperPartialBlock {
  switch (block.type) {
    case "section":
      return {
        id: block.id,
        type: "paperSection",
        props: { kind: block.kind },
        content: plainInline(block.title),
      }
    case "paragraph":
      return {
        id: block.id,
        type: "paragraph",
        content: inlineOf(block.content),
      }
    case "heading":
      return {
        id: block.id,
        type: "heading",
        props: { level: block.level },
        content: inlineOf(block.content),
      }
    case "bullet":
    case "numbered":
      return listItemBlock(block)
    case "divider":
      return { id: block.id, type: "divider" }
    case "experience":
      return {
        id: block.id,
        type: "paperExperience",
        props: {
          role: block.role,
          company: block.company,
          period: block.period,
          location: block.location,
        },
        children: block.children.map(listItemBlock),
      }
    case "education":
      return {
        id: block.id,
        type: "paperEducation",
        props: {
          school: block.school,
          degree: block.degree,
          period: block.period,
          detail: block.detail,
        },
        children: block.children.map(listItemBlock),
      }
    case "skills":
      return {
        id: block.id,
        type: "paperSkills",
        props: { label: block.label },
        children: block.items.map((item, index) => ({
          id: `${block.id}-${index}`,
          type: "paperSkillItem" as const,
          content: plainInline(item),
        })),
      }
  }
}

export function toEditorBlocks(document: PaperDocument): PaperPartialBlock[] {
  const body = document.blocks.map(proseBlock)
  if (document.kind === "letter") return body
  const { header } = document
  return [
    {
      id: header.id,
      type: "paperHeader",
      props: {
        name: header.name,
        email: header.email,
        phone: header.phone,
        city: header.city,
        linkedin: header.linkedin,
        photo: header.photo ?? "",
      },
    },
    ...body,
  ]
}

class Refused extends Error {}

function refuse(reason: string): never {
  throw new Refused(reason)
}

function stringProp(block: EditorBlockLike, name: string): string {
  const value = (block.props as Record<string, unknown> | undefined)?.[name]
  return typeof value === "string" ? value : ""
}

function childrenOf(block: EditorBlockLike): EditorBlockLike[] {
  return (block.children ?? []) as EditorBlockLike[]
}

function listItemOf(block: EditorBlockLike): Record<string, unknown> {
  if (block.type !== "bulletListItem" && block.type !== "numberedListItem") {
    return refuse(`A list holds only list items, not ${block.type}`)
  }
  return {
    id: block.id,
    type: block.type === "bulletListItem" ? "bullet" : "numbered",
    content: normalizeRuns(runsOf(block.content)),
    children: childrenOf(block).map(listItemOf),
  }
}

function leafOf(block: EditorBlockLike): Record<string, unknown> {
  if (childrenOf(block).length > 0) {
    refuse(`A ${block.type} block cannot hold child blocks`)
  }
  const id = block.id
  switch (block.type) {
    case "paperSection":
      return {
        id,
        type: "section",
        kind: stringProp(block, "kind"),
        title: plainTextOfRuns(normalizeRuns(runsOf(block.content))),
      }
    case "paragraph":
      return {
        id,
        type: "paragraph",
        content: normalizeRuns(runsOf(block.content)),
      }
    case "heading":
      return {
        id,
        type: "heading",
        level: (block.props as { level?: number } | undefined)?.level,
        content: normalizeRuns(runsOf(block.content)),
      }
    case "divider":
      return { id, type: "divider" }
    default:
      return refuse(`A ${block.type} block is not part of a paper`)
  }
}

function skillItemOf(block: EditorBlockLike): string {
  if (block.type !== "paperSkillItem") {
    return refuse(`Skills hold only skill items, not ${block.type}`)
  }
  if (childrenOf(block).length > 0) {
    refuse("A skill item cannot hold child blocks")
  }
  return runsOf(block.content)
    .map((run) => run.text)
    .join("")
}

function blockOf(block: EditorBlockLike): Record<string, unknown> {
  switch (block.type) {
    case "paperSkills":
      return {
        id: block.id,
        type: "skills",
        label: stringProp(block, "label"),
        items: childrenOf(block)
          .map(skillItemOf)
          .filter((item) => item !== ""),
      }
    case "bulletListItem":
    case "numberedListItem":
      return listItemOf(block)
    case "paperExperience":
      return {
        id: block.id,
        type: "experience",
        role: stringProp(block, "role"),
        company: stringProp(block, "company"),
        period: stringProp(block, "period"),
        location: stringProp(block, "location"),
        children: childrenOf(block).map(listItemOf),
      }
    case "paperEducation":
      return {
        id: block.id,
        type: "education",
        school: stringProp(block, "school"),
        degree: stringProp(block, "degree"),
        period: stringProp(block, "period"),
        detail: stringProp(block, "detail"),
        children: childrenOf(block).map(listItemOf),
      }
    default:
      return leafOf(block)
  }
}

function headerOf(block: EditorBlockLike | undefined): Record<string, unknown> {
  if (block?.type !== "paperHeader") {
    return refuse("A CV starts with its header block")
  }
  const photo = stringProp(block, "photo")
  return {
    id: HEADER_NODE_ID,
    type: "header",
    name: stringProp(block, "name"),
    email: stringProp(block, "email"),
    phone: stringProp(block, "phone"),
    city: stringProp(block, "city"),
    linkedin: stringProp(block, "linkedin"),
    ...(photo === "" ? {} : { photo }),
  }
}

export function fromEditorBlocks(
  kind: PaperDocument["kind"],
  blocks: readonly EditorBlockLike[]
): PaperResult {
  try {
    const candidate =
      kind === "cv"
        ? {
            version: 3,
            kind,
            header: headerOf(blocks[0]),
            blocks: blocks.slice(1).map(blockOf),
            clashes: [],
          }
        : { version: 3, kind, blocks: blocks.map(blockOf), clashes: [] }
    const parsed = paperDocumentSchema.safeParse(candidate)
    if (parsed.success) return { ok: true, document: parsed.data }
    const issue = parsed.error.issues[0]
    const where = issue?.path.length ? ` at ${issue.path.join(".")}` : ""
    return {
      ok: false,
      reason: `${issue?.message ?? "Invalid document"}${where}`,
    }
  } catch (error) {
    if (error instanceof Refused) return { ok: false, reason: error.message }
    throw error
  }
}
