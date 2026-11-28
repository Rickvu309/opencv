import { z } from "zod"
import { type RichPaperDocument } from "./stored-document.js"
import {
  formatRunSchema,
  type FormatNode,
  type FormatRun,
} from "./native-formatting.js"

const range = z.object({
  blockId: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/),
  from: z.number().int().min(0),
  to: z.number().int().min(0),
  before: z.string().max(100000),
})
const richTextEditSchema = z.discriminatedUnion("op", [
  range
    .extend({ op: z.literal("replaceText"), text: z.string().max(100000) })
    .strict(),
  range
    .extend({
      op: z.literal("formatText"),
      marks: formatRunSchema.omit({ text: true }),
    })
    .strict(),
])
export const richTextEditsSchema = z.array(richTextEditSchema).min(1).max(30)
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
