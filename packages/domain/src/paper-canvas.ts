import { z } from "zod"

import { wordBatchSchema } from "./paper-word.js"

export const PAPER_CANVAS_PROFILE = "paper-canvas-1"

const mint = z
  .object({
    op: z.literal("mint"),
  })
  .strict()

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
