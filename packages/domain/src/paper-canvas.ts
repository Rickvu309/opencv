import { z } from "zod"

import { paperTemplateIdSchema } from "./paper.js"
import { wordBatchSchema, wordPageLabelSchema } from "./paper-word.js"

export const PAPER_CANVAS_PROFILE = "paper-canvas-1"

const mint = z
  .object({
    op: z.literal("mint"),
    label: wordPageLabelSchema,
    templateId: paperTemplateIdSchema.optional(),
  })
  .strict()
  .refine(
    (input) => input.templateId === undefined || input.label === "cv",
    "A template starts a CV page, not a letter."
  )

const write = z
  .object({
    op: z.literal("write"),
    batch: wordBatchSchema,
  })
  .strict()

export const paperCanvasCommitSchema = z
  .discriminatedUnion("op", [mint, write])
  .meta({ type: "object" })

export type PaperCanvasCommit = z.infer<typeof paperCanvasCommitSchema>
