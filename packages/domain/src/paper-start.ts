import { z } from "zod"

import { jobIdSchema } from "./ids.js"
import { paperDocNameSchema, paperTemplateIdSchema } from "./paper.js"
import { wordPageLabelSchema } from "./paper-word.js"

export const PAPER_START_BOUNDS = { lines: 40, lineLength: 120 } as const

export const PAPER_START_TEMPLATE = "simple" as const

export const paperStartInputSchema = z
  .object({
    kind: wordPageLabelSchema,
    templateId: paperTemplateIdSchema.optional(),
    name: paperDocNameSchema.optional(),
    jobId: jobIdSchema.optional(),
  })
  .strict()
  .refine(
    (input) => input.templateId === undefined || input.kind === "cv",
    "A template starts a CV page, not a letter."
  )

export type PaperStartInput = z.infer<typeof paperStartInputSchema>
