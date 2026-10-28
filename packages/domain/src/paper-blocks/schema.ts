import { z } from "zod"

export const blockIdSchema = z.string().min(1)

export const listItemSchema = z
  .object({
    id: blockIdSchema,
    text: z.string(),
  })
  .strict()

/** Id on registry.empty(). Stored documents use their own ids. */
export const EMPTY_BLOCK_ID = "block"
