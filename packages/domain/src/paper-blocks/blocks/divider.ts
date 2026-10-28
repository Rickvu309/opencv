import { z } from "zod"

import { blockIdSchema, EMPTY_BLOCK_ID } from "../schema.js"
import type { DividerBlock, PreviewFragment } from "../types.js"
import { plainTurnInto } from "./turn-into.js"

export const dividerBlock = {
  type: "divider" as const,
  schema: z
    .object({
      id: blockIdSchema,
      type: z.literal("divider"),
    })
    .strict(),
  empty: (): DividerBlock => ({ id: EMPTY_BLOCK_ID, type: "divider" }),
  slash: {
    label: "Divider",
    hint: "A line between blocks",
    group: "blocks" as const,
  },
  print: (): PreviewFragment => ({ kind: "divider" }),
  plainText: () => "",
  turnInto: plainTurnInto("divider"),
}
