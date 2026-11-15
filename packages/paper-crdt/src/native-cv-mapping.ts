import {
  nativeCvDocumentSchema,
  cvRichTextSchema,
  isSafeHref,
  type NativeCvDocument,
  type CvField,
  type CvOwner,
  type CvBody,
  type RichText,
  type TextRun,
} from "@workspace/domain"

import type { NativeCvPartialBlock } from "./native-cv-schema.js"

type InlineText = {
  type: "text"
  text: string
  styles: { bold?: true; italic?: true; underline?: true }
}
type Inline =
  | InlineText
  | { type: "link"; href: NonNullable<TextRun["href"]>; content: InlineText[] }
type Ordinary = {
  id: string
  type: string
  props?: Record<string, unknown>
  content?: unknown
  children?: unknown[]
}

function object(
  value: unknown,
  keys: readonly string[]
): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Expected CV object")
  const record = Object.fromEntries(Object.entries(value))
  if (Object.keys(record).some((key) => !keys.includes(key)))
    throw new Error("Unknown CV property")
  return record
}
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Expected CV props")
  return Object.fromEntries(Object.entries(value))
}
function string(value: unknown): string {
  if (typeof value !== "string") throw new Error("Expected CV string")
  return value
}
function array(value: unknown): unknown[] {
  if (!Array.isArray(value)) throw new Error("Expected CV array")
  return value
}
function textOf(value: unknown): InlineText {
  const part = object(value, ["type", "text", "styles"])
  if (part.type !== "text") throw new Error("Unknown CV inline")
  const styles = object(part.styles, ["bold", "italic", "underline"])
  if (Object.values(styles).some((value) => value !== true))
    throw new Error("Unknown CV style value")
  return {
    type: "text",
    text: string(part.text),
    styles: {
      ...(styles.bold === true ? { bold: true } : {}),
      ...(styles.italic === true ? { italic: true } : {}),
      ...(styles.underline === true ? { underline: true } : {}),
    },
  }
}
function inlineInput(value: unknown): Inline[] {
  return array(value).map((input) => {
    const part = object(input, ["type", "text", "styles", "href", "content"])
    if (part.type === "text") return textOf(input)
    const link = object(input, ["type", "href", "content"])
    if (
      link.type !== "link" ||
      typeof link.href !== "string" ||
      !isSafeHref(link.href)
    )
      throw new Error("Unknown CV inline or unsafe link")
    return {
      type: "link",
      href: link.href,
      content: array(link.content).map(textOf),
    }
  })
}
const ownerNames = {
  header: "paperCvHeader",
  section: "paperCvSection",
  experience: "paperCvExperience",
  education: "paperCvEducation",
  skills: "paperCvSkills",
} as const

function inlineOf(content: RichText): Inline[] {
  return content.map(({ text, href, ...styles }) =>
    href
      ? { type: "link", href, content: [{ type: "text", text, styles }] }
      : { type: "text", text, styles }
  )
}

function runsOf(content: unknown): RichText {
  const runs: TextRun[] = []
  for (const item of inlineInput(content)) {
    if (item.type === "text") runs.push({ text: item.text, ...item.styles })
    else
      for (const part of item.content)
        runs.push({ text: part.text, ...part.styles, href: item.href })
  }
  return cvRichTextSchema.parse(runs.filter((run) => run.text !== ""))
}

function blockOf(node: CvOwner | CvBody | CvField): NativeCvPartialBlock {
  if (node.type === "cvField")
    return {
      id: node.id,
      type: "paperCvField",
      props: {
        ownerId: node.ownerId,
        fieldKey: node.fieldKey,
        itemId: node.itemId ?? "",
      },
      content: inlineOf(node.content),
      children: [],
    }
  if (node.type === "paragraph")
    return {
      id: node.id,
      type: "paragraph",
      content: inlineOf(node.content),
      children: [],
    }
  if (node.type === "heading")
    return {
      id: node.id,
      type: "heading",
      props: { level: node.level },
      content: inlineOf(node.content),
      children: [],
    }
  if (node.type === "bullet" || node.type === "numbered")
    return {
      id: node.id,
      type: node.type === "bullet" ? "bulletListItem" : "numberedListItem",
      content: inlineOf(node.content),
      children: node.children.map(blockOf),
    }
  if (node.type === "divider")
    return { id: node.id, type: "divider", children: [] }
  const children = node.children.map(blockOf)
  switch (node.type) {
    case "header":
      return {
        id: node.id,
        type: ownerNames.header,
        props: { photo: node.photo ?? "" },
        children,
      }
    case "section":
      return {
        id: node.id,
        type: ownerNames.section,
        props: { kind: node.kind },
        children,
      }
    case "experience":
      return { id: node.id, type: ownerNames.experience, children }
    case "education":
      return { id: node.id, type: ownerNames.education, children }
    case "skills":
      return { id: node.id, type: ownerNames.skills, children }
  }
}

export function toNativeCvBlocks(
  document: NativeCvDocument
): NativeCvPartialBlock[] {
  const checked = nativeCvDocumentSchema.parse(document)
  return [blockOf(checked.header), ...checked.blocks.map(blockOf)]
}

function noContent(block: Ordinary): void {
  if (block.content !== undefined)
    throw new Error("Non-inline CV owner cannot hold content")
}
function noChildren(block: Ordinary): void {
  if (block.children?.length)
    throw new Error("Leaf CV block cannot hold children")
}
function readBlock(input: unknown): unknown {
  const shape = object(input, ["id", "type", "props", "content", "children"])
  const block: Ordinary = {
    id: string(shape.id),
    type: string(shape.type),
    ...(shape.props === undefined ? {} : { props: record(shape.props) }),
    ...(shape.content === undefined ? {} : { content: shape.content }),
    ...(shape.children === undefined
      ? {}
      : { children: array(shape.children) }),
  }
  const props = block.props ?? {}
  const children = block.children ?? []
  const id = block.id
  if (block.type === "paperCvField") {
    noChildren(block)
    const identity = object(props, ["ownerId", "fieldKey", "itemId"])
    string(identity.ownerId)
    string(identity.fieldKey)
    const itemId = identity.itemId === undefined ? "" : string(identity.itemId)
    return {
      id,
      type: "cvField",
      ownerId: identity.ownerId,
      fieldKey: identity.fieldKey,
      ...(itemId ? { itemId } : {}),
      content: runsOf(block.content),
    }
  }
  const owner = Object.entries(ownerNames).find(
    ([, name]) => name === block.type
  )?.[0]
  if (owner) {
    noContent(block)
    let extra = {}
    if (owner === "header") {
      const checked = object(props, ["photo"])
      const photo = checked.photo === undefined ? "" : string(checked.photo)
      extra = photo ? { photo } : {}
    } else if (owner === "section")
      extra = { kind: string(object(props, ["kind"]).kind) }
    else object(props, [])
    return { id, type: owner, ...extra, children: children.map(readBlock) }
  }
  if (block.type === "heading") {
    noChildren(block)
    const { level } = object(props, ["level"])
    if (level !== 2 && level !== 3) throw new Error("Unknown CV heading level")
    return { id, type: "heading", level, content: runsOf(block.content) }
  }
  object(props, [])
  if (block.type === "divider") {
    noContent(block)
    noChildren(block)
    return { id, type: "divider" }
  }
  if (block.type === "paragraph") {
    noChildren(block)
    return { id, type: "paragraph", content: runsOf(block.content) }
  }
  if (block.type === "bulletListItem" || block.type === "numberedListItem")
    return {
      id,
      type: block.type === "bulletListItem" ? "bullet" : "numbered",
      content: runsOf(block.content),
      children: children.map(readBlock),
    }
  throw new Error(`Unknown CV engine block ${block.type}`)
}

export function fromNativeCvBlocks(input: unknown): NativeCvDocument {
  const blocks = array(input).map(readBlock)
  if (!blocks.length) throw new Error("CV header is missing")
  return nativeCvDocumentSchema.parse({
    version: 4,
    schemaRevision: 2,
    kind: "cv",
    header: blocks[0],
    blocks: blocks.slice(1),
  })
}
