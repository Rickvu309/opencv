import {
  canonical,
  flowDocumentSchema,
  flowSectionSchema,
  type FlowDocument,
  type DocumentPresentation,
} from "@workspace/domain/internal/paper-presentation"
import { array, object, string } from "./native-formatting-inline.js"
import { layoutBlock, readLayoutBlock } from "./native-layout-codec.js"
import type { PrivateLayoutBlock } from "./native-layout-schema.js"

export function flowBlocks(input: FlowDocument): PrivateLayoutBlock[] {
  const document = flowDocumentSchema.parse(input)
  return [
    {
      id: document.flow.id,
      type: "paperFlow",
      children: document.flow.children.map(
        ({ id, start, page, columns, children }) => ({
          id,
          type: "paperFlowSection",
          props: { settings: canonical({ start, page, columns }) },
          children: children.map((node) =>
            node.type === "pageBreak"
              ? { id: node.id, type: "paperPageBreak" }
              : layoutBlock(node)
          ),
        })
      ),
    },
  ]
}
export function readFlowBlocks(
  input: unknown,
  kind: "cv" | "letter",
  presentation: DocumentPresentation
): FlowDocument {
  const blocks = array(input)
  if (blocks.length !== 1) throw new Error("Flow requires one root")
  const root = object(blocks[0], ["id", "type", "props", "children", "content"])
  if (root.type !== "paperFlow" || root.content !== undefined)
    throw new Error("Wrong flow root")
  object(root.props ?? {}, [])
  const children = array(root.children).map((input) => {
    const section = object(input, [
      "id",
      "type",
      "props",
      "children",
      "content",
    ])
    if (section.type !== "paperFlowSection" || section.content !== undefined)
      throw new Error("Wrong section node")
    const props = object(section.props, ["settings"])
    const settings = flowSectionSchema
      .omit({ id: true, type: true, children: true })
      .parse(JSON.parse(string(props.settings)))
    if (canonical(settings) !== props.settings)
      throw new Error("Noncanonical flow settings")
    return {
      id: string(section.id),
      type: "flowSection",
      ...settings,
      children: array(section.children).map((input) => {
        const node = object(input)
        if (node.type !== "paperPageBreak") return readLayoutBlock(input)
        object(node, ["id", "type", "props", "children", "content"])
        object(node.props ?? {}, [])
        if (node.content !== undefined || array(node.children ?? []).length)
          throw new Error("Page break cannot hold content")
        return { id: string(node.id), type: "pageBreak" }
      }),
    }
  })
  return flowDocumentSchema.parse({
    profile: "private-layout-3",
    kind,
    presentation,
    flow: { id: string(root.id), type: "flow", children },
  })
}
