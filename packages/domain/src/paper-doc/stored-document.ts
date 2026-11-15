import { z } from "zod"
import { paperDocumentSchema, type PaperDocument } from "./document.js"
import type { FormatNode } from "./native-formatting.js"
import type { LayoutRow, LayoutCell } from "./native-layout.js"
import {
  flowDocumentSchema,
  type FlowSection,
  type FlowNode,
} from "./native-layout-flow.js"
import { paperPhotoFileId } from "../paper.js"

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
export const storedPaperDocumentSchema = z.union([
  paperDocumentSchema,
  richPaperDocumentSchema,
])
export type StoredPaperDocument = z.infer<typeof storedPaperDocumentSchema>

export function requirePaperDocument(
  document: StoredPaperDocument
): PaperDocument {
  if (document.version === 4 && document.schemaRevision === 2)
    throw new Error(
      "This document needs the rich Paper editor. Nothing was changed."
    )
  return document
}

export function storedPaperPhotoIds(input: unknown): string[] {
  const parsed = storedPaperDocumentSchema.safeParse(input)
  if (!parsed.success) return []
  const document = parsed.data
  const ids = new Set<string>()
  const add = (source: string | undefined) => {
    const id = paperPhotoFileId(source)
    if (id) ids.add(id.toLowerCase())
  }
  if (document.version === 4 && document.schemaRevision === 2) {
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
  } else if (document.kind === "cv") add(document.header.photo)
  return [...ids]
}
