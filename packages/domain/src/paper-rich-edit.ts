import type { RichPaperDocument } from "./paper-doc/stored-document.js"
import type { FormatNode, FormatRun } from "./paper-doc/native-formatting.js"

type TextNode = Extract<FormatNode, { content: FormatRun[] }>

export function richTextNodes(document: RichPaperDocument): TextNode[] {
  const result: TextNode[] = []
  const visit = (node: FormatNode) => {
    if ("content" in node) result.push(node)
    if ("children" in node) node.children.forEach(visit)
  }
  for (const section of document.flow.children)
    for (const node of section.children)
      if (
        node.type !== "table" &&
        node.type !== "photo" &&
        node.type !== "pageBreak"
      )
        visit(node)
  return result
}
