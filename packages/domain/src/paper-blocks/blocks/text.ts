import { z } from "zod"

import { blockIdSchema, EMPTY_BLOCK_ID } from "../schema.js"
import type { PreviewFragment, TextBlock } from "../types.js"
import { plainTurnInto } from "./turn-into.js"

export const textBlock = {
  type: "text" as const,
  schema: z
    .object({
      id: blockIdSchema,
      type: z.literal("text"),
      text: z.string(),
    })
    .strict(),
  empty: (): TextBlock => ({ id: EMPTY_BLOCK_ID, type: "text", text: "" }),
  slash: { label: "Text", hint: "A paragraph", group: "blocks" as const },
  print: (block: TextBlock): PreviewFragment => ({
    kind: "text",
    text: block.text,
  }),
  plainText: (block: TextBlock) => block.text,
  turnInto: plainTurnInto("text"),
}
