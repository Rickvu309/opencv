import { z } from "zod"
import { defineOperation } from "../../../operation.js"
import type { ResourceRef } from "../../../resources.js"
import {
  paperDocNameSchema,
  paperTemplateIdSchema,
} from "../../../paper-doc/paper.js"

export const operation = defineOperation({
  owner: "paper",
  name: "paper.start",
  version: 2,
  kind: "command",
  description:
    "Start a new CV or Letter as a Paper. A CV starts from a template whose lines are bracketed placeholders such as [Your name] under fixed headings; a Letter starts blank. Pass jobId when it is for a Job. The person approves the new Paper first. It writes none of your words: after it is made, read it with paper.outline and propose its words with paper.edit, which the person approves. Replace a placeholder only with facts the person gave in their Profile or this Chat; never invent experience or qualifications.",
  label: "Start a CV or Letter in Paper",
  input: z
    .object({
      kind: z.enum(["cv", "letter"]),
      templateId: paperTemplateIdSchema.optional(),
      name: paperDocNameSchema.optional(),
      jobId: z.string().uuid().optional(),
    })
    .strict()
    .refine(
      (input) => input.templateId === undefined || input.kind === "cv",
      "A template starts a CV page, not a letter."
    ),
  publicResult: z
    .object({
      docId: z.string().uuid(),
      name: z.string(),
      kind: z.enum(["cv", "letter"]),
    })
    .strip(),
  coach: "confirm",
  destructive: false,
  idempotency: "keyed",
  writes: (): readonly ResourceRef[] => [{ name: "paper", coachFloor: "auto" }],
})
