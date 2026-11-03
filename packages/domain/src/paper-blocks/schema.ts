import { z } from "zod"

export const blockIdSchema = z.string().min(1)

export const listItemSchema = z
  .object({
    id: blockIdSchema,
    text: z.string(),
  })
  .strict()

export const EMPTY_BLOCK_ID = "block"
