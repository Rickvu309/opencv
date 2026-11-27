import { z } from "zod"
import { defineOperation } from "../../../operation.js"
import type { ResourceRef } from "../../../resources.js"
import {
  paperDocNameSchema,
  paperStoredKindSchema,
  paperTemplateIdSchema,
} from "../../../paper-doc/paper.js"
import { startingLinesSchema } from "../../../paper-doc/starting-lines.js"

export const operation = defineOperation({
  owner: "paper",
  name: "paper.create",
  version: 2,
  kind: "command",
  description:
    "Create a CV or Letter. A blank Paper starts as one empty paragraph that opens the full editor. A CV can start from templateId, and a Letter from drafted lines. Pass jobId to link it to a Job.",
  label: "Create a Paper",
  input: z
    .object({
      kind: paperStoredKindSchema,
      format: z.literal("rich").optional(),
      name: paperDocNameSchema.optional(),
      jobId: z.string().uuid().optional(),
      templateId: paperTemplateIdSchema.optional(),
      lines: startingLinesSchema.optional(),
      engine: z.literal(2).optional(),
    })
    .strict()
    .refine(
      (input) => input.templateId === undefined || input.kind === "cv",
      "A template starts a CV, not a letter."
    )
    .refine(
      (input) => input.templateId === undefined || input.lines === undefined,
      "Start from a template or from lines, not both."
    )
    .refine(
      (input) =>
        input.engine === undefined ||
        (input.templateId === undefined &&
          input.lines === undefined &&
          input.format === undefined),
      "A Paper on the new engine starts blank."
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
