import { z } from "zod"
import { flowDocumentSchema } from "./native-layout-flow.js"

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
