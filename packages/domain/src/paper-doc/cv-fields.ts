import { z } from "zod"

import { nodeIdSchema, type NodeId } from "./nodes.js"
import { normalizeRuns, safeHrefSchema, type RichText } from "./rich-text.js"

export const cvSlots = {
  header: ["name", "headline", "email", "phone", "city", "linkedin"],
  section: ["title"],
  experience: ["role", "company", "period", "location"],
  education: ["school", "degree", "period", "detail"],
  skills: ["label"],
} as const

const cvFieldKeySchema = z.enum([
  "name",
  "headline",
  "email",
  "phone",
  "city",
  "linkedin",
  "title",
  "role",
  "company",
  "period",
  "location",
  "school",
  "degree",
  "detail",
  "label",
  "item",
])
export type CvFieldKey = z.infer<typeof cvFieldKeySchema>

export const cvRichTextSchema: z.ZodType<RichText> = z
  .array(
    z
      .object({
        text: z
          .string()
          .min(1)
          .refine((text) =>
            [...text].every((char) => {
              const code = char.charCodeAt(0)
              return code === 9 || code === 10 || (code >= 32 && code !== 127)
            })
          ),
        bold: z.literal(true).optional(),
        italic: z.literal(true).optional(),
        underline: z.literal(true).optional(),
        href: safeHrefSchema.optional(),
      })
      .strict()
  )
  .transform((runs): RichText => normalizeRuns(runs))

export type CvField = {
  id: NodeId
  type: "cvField"
  ownerId: NodeId
  fieldKey: CvFieldKey
  itemId?: NodeId
  content: RichText
}

export const cvFieldSchema: z.ZodType<CvField> = z
  .object({
    id: nodeIdSchema,
    type: z.literal("cvField"),
    ownerId: nodeIdSchema,
    fieldKey: cvFieldKeySchema,
    itemId: nodeIdSchema.optional(),
    content: cvRichTextSchema.refine((runs) =>
      runs.every((run) => !/[\t\n\r]/u.test(run.text))
    ),
  })
  .strict()
  .superRefine((field, ctx) => {
    if ((field.fieldKey === "item") !== (field.itemId !== undefined))
      ctx.addIssue({
        code: "custom",
        message: "Only item fields require itemId",
      })
  })
export type CvFieldTarget = {
  readonly ownerId: NodeId
  readonly fieldId: NodeId
  readonly fieldKey: CvFieldKey
  readonly itemId?: NodeId
}
export type CvFieldRange = CvFieldTarget & {
  readonly from: number
  readonly to: number
}
