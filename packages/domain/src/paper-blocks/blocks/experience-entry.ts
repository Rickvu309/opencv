import { z } from "zod"

import { blockIdSchema, EMPTY_BLOCK_ID, listItemSchema } from "../schema.js"
import type { ExperienceEntryBlock, PreviewFragment } from "../types.js"

export const experienceEntryBlock = {
  type: "experience-entry" as const,
  schema: z
    .object({
      id: blockIdSchema,
      type: z.literal("experience-entry"),
      role: z.string(),
      company: z.string(),
      period: z.string(),
      location: z.string().optional(),
      bullets: z.array(listItemSchema),
    })
    .strict(),
  empty: (): ExperienceEntryBlock => ({
    id: EMPTY_BLOCK_ID,
    type: "experience-entry",
    role: "",
    company: "",
    period: "",
    bullets: [],
  }),
  print: (block: ExperienceEntryBlock): PreviewFragment => ({
    kind: "experience",
    role: block.role,
    company: block.company,
    period: block.period,
    ...(block.location ? { location: block.location } : {}),
    bullets: block.bullets.map((bullet) => bullet.text),
  }),
  plainText: (block: ExperienceEntryBlock) =>
    [
      block.role,
      block.company,
      block.period,
      block.location ?? "",
      ...block.bullets.map((bullet) => bullet.text),
    ]
      .filter((part) => part.length > 0)
      .join("\n"),
  turnInto: [] as const,
}
