import { z } from "zod"
import { defineOperation } from "../../../operation.js"
import type { ResourceRef } from "../../../resources.js"
import {
  paperDocNameSchema,
  paperStoredKindSchema,
  paperTemplateIdSchema,
} from "../../../paper-doc/paper.js"

export const operation = defineOperation({
  owner: "paper",
  name: "paper.create",
  version: 2,
  kind: "command",
  description:
    "Create a CV or Letter. A blank Paper starts as one empty paragraph that opens the full editor. A CV can start from templateId. Pass jobId to link it to a Job.",
  label: "Create a Paper",
  input: z
    .object({
      kind: paperStoredKindSchema,
      format: z.literal("rich").optional(),
      name: paperDocNameSchema.optional(),
      jobId: z.string().uuid().optional(),
      templateId: paperTemplateIdSchema.optional(),
    })
    .strict()
    .refine(
      (input) => input.templateId === undefined || input.kind === "cv",
      "A template starts a CV, not a letter."
    ),
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
