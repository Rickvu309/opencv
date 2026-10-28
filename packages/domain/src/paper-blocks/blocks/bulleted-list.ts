import { z } from "zod"

import { blockIdSchema, EMPTY_BLOCK_ID, listItemSchema } from "../schema.js"
import type { BulletedListBlock, PreviewFragment } from "../types.js"
import { plainTurnInto } from "./turn-into.js"

export const bulletedListBlock = {
  type: "bulleted-list" as const,
  schema: z
    .object({
      id: blockIdSchema,
      type: z.literal("bulleted-list"),
      items: z.array(listItemSchema),
    })
    .strict(),
  empty: (): BulletedListBlock => ({
    id: EMPTY_BLOCK_ID,
    type: "bulleted-list",
    items: [],
  }),
  slash: {
    label: "Bulleted list",
    hint: "Points in a list",
    group: "blocks" as const,
  },
  print: (block: BulletedListBlock): PreviewFragment => ({
    kind: "list",
    ordered: false,
    items: block.items.map((item) => item.text),
  }),
  plainText: (block: BulletedListBlock) =>
    block.items.map((item) => item.text).join("\n"),
  turnInto: plainTurnInto("bulleted-list"),
}
