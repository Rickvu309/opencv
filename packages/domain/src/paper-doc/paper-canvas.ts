import { z } from "zod"

import { paperDocNameSchema, paperTemplateIdSchema } from "./paper.js"
import {
  WORD_LIMITS,
  wordBatchSchema,
  wordPageLabelSchema,
} from "./paper-word.js"

declare const TextEncoder: {
  new (): { encode(input: string): { byteLength: number } }
}

export const PAPER_CANVAS_PROFILE = "paper-canvas-1"

const encodedBytes = (value: string) =>
  new TextEncoder().encode(value).byteLength

function holdsControlCode(value: string) {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index)
    if (code < 32 || code === 127) return true
  }
  return false
}

const startingLineSchema = z
  .string()
  .refine(
    (value) => !holdsControlCode(value),
    "A line must not hold control characters."
  )
  .refine(
    (value) => encodedBytes(value) <= WORD_LIMITS.maxTextBytes,
    "A line exceeds 8 KiB."
  )

const startingLinesSchema = z
  .array(startingLineSchema)
  .min(1)
  .max(WORD_LIMITS.maxOpsPerApply)
  .refine(
    (lines) =>
      lines.reduce((total, line) => total + encodedBytes(line), 0) <=
      WORD_LIMITS.maxBatchTextBytes,
    "The starting text exceeds 64 KiB."
  )

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
