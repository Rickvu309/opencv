import { z } from "zod"

import { blockIdSchema, EMPTY_BLOCK_ID } from "../schema.js"
import type { EducationEntryBlock, PreviewFragment } from "../types.js"

export const educationEntryBlock = {
  type: "education-entry" as const,
  schema: z
    .object({
      id: blockIdSchema,
      type: z.literal("education-entry"),
      school: z.string(),
      degree: z.string(),
      period: z.string(),
      detail: z.string(),
    })
    .strict(),
  empty: (): EducationEntryBlock => ({
    id: EMPTY_BLOCK_ID,
    type: "education-entry",
    school: "",
    degree: "",
    period: "",
    detail: "",
  }),
  print: (block: EducationEntryBlock): PreviewFragment => ({
    kind: "education",
    school: block.school,
    degree: block.degree,
    period: block.period,
    detail: block.detail,
  }),
  plainText: (block: EducationEntryBlock) =>
    [block.school, block.degree, block.period, block.detail]
      .filter((part) => part.length > 0)
      .join("\n"),
  turnInto: [] as const,
}
