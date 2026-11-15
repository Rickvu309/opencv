import {
  layoutDocumentSchema,
  canonical,
  layoutPhotoSchema,
  type LayoutPhoto,
  type FormatNode,
  type LayoutDocument,
  type LayoutTable,
} from "@workspace/domain/internal/paper-presentation"
import type { DocumentPresentation } from "@workspace/domain/internal/paper-presentation"
import { blockOf, readBlock } from "./native-formatting-cv.js"
import { array, object, string } from "./native-formatting-inline.js"
import type { HeadlessLayoutBlock as PrivateLayoutBlock } from "./native-formatting-headless.js"

function contentBlock(node: FormatNode | LayoutPhoto): PrivateLayoutBlock {
  return node.type === "photo"
    ? { id: node.id, type: "paperPhoto", props: { photo: canonical(node) } }
    : blockOf(node)
}
function tableBlock(table: LayoutTable): PrivateLayoutBlock {
  return {
    id: table.id,
    type: "paperTable",
    props: { columns: canonical(table.columns) },
    children: table.children.map((row) => ({
      id: row.id,
      type: "paperRow",
      children: row.children.map((cell) => ({
        id: cell.id,
        type: "paperCell",
        props: { columnId: cell.columnId },
        children: cell.children.map(contentBlock),
      })),
    })),
  }
}
export function layoutBlock(
  node: FormatNode | LayoutPhoto | LayoutTable
): PrivateLayoutBlock {
  return node.type === "table" ? tableBlock(node) : contentBlock(node)
}
export function toLayoutBlocks(document: LayoutDocument): PrivateLayoutBlock[] {
  const doc = layoutDocumentSchema.parse(document)
  return [
    {
      id: doc.flow.id,
      type: "paperFlow",
      children: doc.flow.children.map(layoutBlock),
    },
  ]
}
export function readLayoutBlock(input: unknown): unknown {
  const block = object(input, ["id", "type", "props", "children", "content"])
  const type = string(block.type)
  if (type === "paperPhoto") {
    const props = object(block.props ?? {}, ["photo"])
    if (block.content !== undefined || array(block.children ?? []).length)
      throw new Error("Photo cannot hold content")
    const photo = layoutPhotoSchema.parse(JSON.parse(string(props.photo)))
    if (photo.id !== string(block.id) || canonical(photo) !== props.photo)
      throw new Error("Noncanonical photo block")
    return photo
  }
  if (!["paperFlow", "paperTable", "paperRow", "paperCell"].includes(type))
    return readBlock(input)
  if (block.content !== undefined)
    throw new Error("Layout containers cannot hold inline content")
  const children = array(block.children).map(readLayoutBlock)
  const id = string(block.id)
  const props = object(block.props ?? {})
  switch (type) {
    case "paperFlow":
      object(props, [])
      return { id, type: "flow", children }
    case "paperTable":
      object(props, ["columns"])
      return {
        id,
        type: "table",
        columns: JSON.parse(string(props.columns)),
        children,
      }
    case "paperRow":
      object(props, [])
      return { id, type: "row", children }
    case "paperCell":
      object(props, ["columnId"])
      return { id, type: "cell", columnId: string(props.columnId), children }
    default:
      throw new Error("Unknown layout block")
  }
}
export function fromLayoutBlocks(
  input: unknown,
  kind: "cv" | "letter",
  presentation: DocumentPresentation,
  profile: LayoutDocument["profile"] = "private-layout-1"
): LayoutDocument {
  const blocks = array(input)
  if (blocks.length !== 1) throw new Error("Layout requires one flow")
  return layoutDocumentSchema.parse({
    profile,
    kind,
    presentation,
    flow: readLayoutBlock(blocks[0]),
  })
}
