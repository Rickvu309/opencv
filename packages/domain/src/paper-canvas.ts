import { z } from "zod"

export const PAPER_CANVAS_PROFILE = "paper-canvas-1"

const identity = z.string().uuid()

const mint = z
  .object({
    op: z.literal("mint"),
  })
  .strict()

const split = z
  .object({
    op: z.literal("split"),
    docId: identity,
    basedOn: identity,
    paragraph: identity,
    at: z.number().int().nonnegative(),
  })
  .strict()

const adjacent = z
  .object({
    op: z.enum(["mergePrevious", "deleteParagraph"]),
    docId: identity,
    basedOn: identity,
    paragraph: identity,
  })
  .strict()

export const paperCanvasCommitSchema = z.discriminatedUnion("op", [
  mint,
  split,
  adjacent,
])

export type PaperCanvasCommit = z.infer<typeof paperCanvasCommitSchema>
