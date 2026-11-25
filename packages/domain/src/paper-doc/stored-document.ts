import { z } from "zod"
import type { FormatNode } from "./native-formatting.js"
import type { LayoutRow, LayoutCell } from "./native-layout.js"
import {
  flowDocumentSchema,
  type FlowSection,
  type FlowNode,
} from "./native-layout-flow.js"
import { paperPhotoFileId } from "./paper.js"

export const richPaperDocumentSchema = z
  .object({
    version: z.literal(4),
    schemaRevision: z.literal(2),
    ...flowDocumentSchema.in.shape,
  })
  .strict()
  .transform(({ version, schemaRevision, ...flow }, ctx) => {
    const parsed = flowDocumentSchema.safeParse(flow)
    if (!parsed.success) {
      for (const issue of parsed.error.issues) ctx.addIssue({ ...issue })
      return z.NEVER
    }
    return { version, schemaRevision, ...parsed.data }
  })

export type RichPaperDocument = z.infer<typeof richPaperDocumentSchema>
export const storedPaperDocumentSchema = richPaperDocumentSchema
export type StoredPaperDocument = z.infer<typeof storedPaperDocumentSchema>

export function storedPaperPhotoIds(input: unknown): string[] {
  const parsed = storedPaperDocumentSchema.safeParse(input)
  if (!parsed.success) return []
  const document = parsed.data
  const ids = new Set<string>()
  const add = (source: string | undefined) => {
    const id = paperPhotoFileId(source)
    if (id) ids.add(id.toLowerCase())
  }
  const visit = (
    node:
      | RichPaperDocument["flow"]
      | FlowSection
      | FlowNode
      | FormatNode
      | LayoutRow
      | LayoutCell
  ) => {
    if (node.type === "photo") add(node.source)
    if (node.type === "header") add(node.photo)
    if ("children" in node) node.children.forEach(visit)
  }
  visit(document.flow)
  return [...ids]
}
