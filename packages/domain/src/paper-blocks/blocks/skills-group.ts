import { z } from "zod"

import { blockIdSchema, EMPTY_BLOCK_ID } from "../schema.js"
import type { PreviewFragment, SkillsGroupBlock } from "../types.js"

export const skillsGroupBlock = {
  type: "skills-group" as const,
  schema: z
    .object({
      id: blockIdSchema,
      type: z.literal("skills-group"),
      label: z.string(),
      items: z.array(z.string()),
    })
    .strict(),
  empty: (): SkillsGroupBlock => ({
    id: EMPTY_BLOCK_ID,
    type: "skills-group",
    label: "",
    items: [],
  }),
  print: (block: SkillsGroupBlock): PreviewFragment => ({
    kind: "skills",
    label: block.label,
    items: block.items,
  }),
  plainText: (block: SkillsGroupBlock) =>
    [block.label, ...block.items].filter((part) => part.length > 0).join("\n"),
  turnInto: [] as const,
}
