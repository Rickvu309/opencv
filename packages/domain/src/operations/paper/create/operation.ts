import { z } from "zod"
import { defineOperation } from "../../../operation.js"
import type { ResourceRef } from "../../../resources.js"
import {
  paperDocNameSchema,
  paperStoredKindSchema,
} from "../../../paper-doc/paper.js"

export const operation = defineOperation({
  owner: "paper",
  name: "paper.create",
  version: 1,
  kind: "command",
  description:
    "Create a CV or Letter. A rich Paper starts as one empty paragraph that opens the full editor. Pass jobId to link it to a Job.",
  label: "Create a Paper",
  input: z
    .object({
      kind: paperStoredKindSchema,
      format: z.literal("rich").optional(),
      name: paperDocNameSchema.optional(),
      jobId: z.string().uuid().optional(),
    })
    .strict(),
  publicResult: z
    .object({
      id: z.string().uuid(),
      name: z.string(),
      kind: paperStoredKindSchema,
      format: z.enum(["word", "rich", "prose"]).optional(),
    })
    .strip(),
  coach: "never",
  destructive: false,
  idempotency: "keyed",
  writes: (): readonly ResourceRef[] => [{ name: "paper", coachFloor: "auto" }],
})
