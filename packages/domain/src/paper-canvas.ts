import { z } from "zod"

declare const TextEncoder: {
  new (): { encode(value: string): Uint8Array }
}

export const PAPER_CANVAS_PROFILE = "paper-canvas-1"

const identity = z.string().uuid()
const textLimit = 8 * 1024

const writtenText = z
  .string()
  .min(1)
  .refine(
    (value) =>
      !/[\r\n]/.test(value) &&
      new TextEncoder().encode(value).byteLength <= textLimit,
    "This text is larger than the supported Word region."
  )

const mint = z
  .object({
    op: z.literal("mint"),
  })
  .strict()

const writeText = z
  .object({
    op: z.literal("writeText"),
    docId: identity,
    basedOn: identity,
    paragraph: identity,
    text: writtenText,
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

export const paperCanvasCommitSchema = z
  .discriminatedUnion("op", [mint, writeText, split, adjacent])
  .meta({ type: "object" })

export type PaperCanvasCommit = z.infer<typeof paperCanvasCommitSchema>
