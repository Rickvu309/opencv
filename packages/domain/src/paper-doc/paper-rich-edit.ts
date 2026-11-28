import { z } from "zod"
import { formatRunSchema } from "./native-formatting.js"

const range = z.object({
  blockId: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/),
  from: z.number().int().min(0),
  to: z.number().int().min(0),
  before: z.string().max(100000),
})
const richTextEditSchema = z.discriminatedUnion("op", [
  range
    .extend({ op: z.literal("replaceText"), text: z.string().max(100000) })
    .strict(),
  range
    .extend({
      op: z.literal("formatText"),
      marks: formatRunSchema.omit({ text: true }),
    })
    .strict(),
])
export const richTextEditsSchema = z.array(richTextEditSchema).min(1).max(30)
