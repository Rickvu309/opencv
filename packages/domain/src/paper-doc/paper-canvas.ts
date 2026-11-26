import { z } from "zod"

import { paperDocNameSchema, paperTemplateIdSchema } from "./paper.js"
import { startingLinesSchema } from "./starting-lines.js"
import { wordBatchSchema, wordPageLabelSchema } from "./paper-word.js"

export const PAPER_CANVAS_PROFILE = "paper-canvas-1"

const mint = z
  .object({
    op: z.literal("mint"),
    label: wordPageLabelSchema,
    templateId: paperTemplateIdSchema.optional(),
    name: paperDocNameSchema.optional(),
    jobId: z.string().uuid().optional(),
    lines: startingLinesSchema.optional(),
  })
  .strict()
  .refine(
    (input) => input.templateId === undefined || input.label === "cv",
    "A template starts a CV page, not a letter."
  )
  .refine(
    (input) => input.templateId === undefined || input.lines === undefined,
    "Start from a template or from lines, not both."
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
