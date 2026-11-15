import {
  formattedDocumentSchema,
  type FormatNode,
  type DocumentPresentation,
  type PrivateFormattedDocument,
} from "@workspace/domain/internal/paper-presentation"
import type { PrivateFormattingBlock } from "./native-formatting-schema.js"
import {
  object,
  string,
  array,
  inlineOf,
  runsOf,
} from "./native-formatting-inline.js"
import {
  canonicalProps,
  engineProps,
  formattingProps,
} from "./native-formatting-props.js"
type Ordinary = {
  id: string
  type: string
  props?: Record<string, unknown>
  content?: unknown
  children?: unknown[]
}
const record = (input: unknown) => object(input)
const ownerNames = {
  header: "paperCvHeader",
  section: "paperCvSection",
  experience: "paperCvExperience",
  education: "paperCvEducation",
  skills: "paperCvSkills",
} as const
export function blockOf(node: FormatNode): PrivateFormattingBlock {
  if (node.type === "cvField")
    return {
      id: node.id,
      type: "paperCvField",
      props: {
        ...engineProps(node.paragraph),
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
      props: engineProps(node.paragraph),
      content: inlineOf(node.content),
      children: [],
    }
  if (node.type === "heading")
    return {
      id: node.id,
      type: "heading",
      props: { ...engineProps(node.paragraph), level: node.level },
      content: inlineOf(node.content),
      children: [],
    }
  if (node.type === "bullet" || node.type === "numbered")
    return {
      id: node.id,
      type: node.type === "bullet" ? "bulletListItem" : "numberedListItem",
      props: engineProps(node.paragraph),
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

function noContent(block: Ordinary): void {
  if (block.content !== undefined)
    throw new Error("Non-inline CV owner cannot hold content")
}
function noChildren(block: Ordinary): void {
  if (block.children?.length)
    throw new Error("Leaf CV block cannot hold children")
}
export function readBlock(input: unknown): unknown {
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
  const allProps = block.props ?? {}
  const inline = [
    "paragraph",
    "heading",
    "bulletListItem",
    "numberedListItem",
    "paperCvField",
  ].includes(block.type)
  const paragraph = inline ? canonicalProps(allProps) : undefined
  const props = Object.fromEntries(
    Object.entries(allProps).filter(
      ([key]) => !inline || !(key in formattingProps)
    )
  )
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
      paragraph,
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
    return {
      id,
      type: "heading",
      level,
      paragraph,
      content: runsOf(block.content),
    }
  }
  object(props, [])
  if (block.type === "divider") {
    noContent(block)
    noChildren(block)
    return { id, type: "divider" }
  }
  if (block.type === "paragraph") {
    noChildren(block)
    return { id, type: "paragraph", paragraph, content: runsOf(block.content) }
  }
  if (block.type === "bulletListItem" || block.type === "numberedListItem")
    return {
      id,
      type: block.type === "bulletListItem" ? "bullet" : "numbered",
      paragraph,
      content: runsOf(block.content),
      children: children.map(readBlock),
    }
  throw new Error(`Unknown CV engine block ${block.type}`)
}

export function toFormattingBlocks(
  document: PrivateFormattedDocument
): PrivateFormattingBlock[] {
  const doc = formattedDocumentSchema.parse(document)
  return (doc.kind === "cv" ? [doc.header, ...doc.blocks] : doc.blocks).map(
    blockOf
  )
}
export function fromFormattingBlocks(
  input: unknown,
  kind: "cv" | "letter",
  presentation: DocumentPresentation
): PrivateFormattedDocument {
  const blocks = array(input).map(readBlock)
  return formattedDocumentSchema.parse({
    profile: "private-formatting-1",
    presentation,
    kind,
    ...(kind === "cv"
      ? { header: blocks[0], blocks: blocks.slice(1) }
      : { blocks }),
  })
}
