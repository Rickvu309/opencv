import { z } from "zod"

import { blockIdSchema, EMPTY_BLOCK_ID } from "../schema.js"
import type { HeadingBlock, PreviewFragment } from "../types.js"
import { plainTurnInto } from "./turn-into.js"

export const headingBlock = {
  type: "heading" as const,
  schema: z
    .object({
      id: blockIdSchema,
      type: z.literal("heading"),
      text: z.string(),
    })
    .strict(),
  empty: (): HeadingBlock => ({
    id: EMPTY_BLOCK_ID,
    type: "heading",
    text: "",
  }),
  slash: { label: "Heading", hint: "A title", group: "blocks" as const },
  print: (block: HeadingBlock): PreviewFragment => ({
    kind: "heading",
    text: block.text,
  }),
  plainText: (block: HeadingBlock) => block.text,
  turnInto: plainTurnInto("heading"),
}
