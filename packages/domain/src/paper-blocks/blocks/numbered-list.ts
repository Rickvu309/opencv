import { z } from "zod"

import { blockIdSchema, EMPTY_BLOCK_ID, listItemSchema } from "../schema.js"
import type { NumberedListBlock, PreviewFragment } from "../types.js"
import { plainTurnInto } from "./turn-into.js"

export const numberedListBlock = {
  type: "numbered-list" as const,
  schema: z
    .object({
      id: blockIdSchema,
      type: z.literal("numbered-list"),
      items: z.array(listItemSchema),
    })
    .strict(),
  empty: (): NumberedListBlock => ({
    id: EMPTY_BLOCK_ID,
    type: "numbered-list",
    items: [],
  }),
  slash: {
    label: "Numbered list",
    hint: "Steps in order",
    group: "blocks" as const,
  },
  print: (block: NumberedListBlock): PreviewFragment => ({
    kind: "list",
    ordered: true,
    items: block.items.map((item) => item.text),
  }),
  plainText: (block: NumberedListBlock) =>
    block.items.map((item) => item.text).join("\n"),
  turnInto: plainTurnInto("numbered-list"),
}
