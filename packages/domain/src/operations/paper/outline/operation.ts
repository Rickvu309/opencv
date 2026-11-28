import { z } from "zod"
import { defineOperation } from "../../../operation.js"
import type { ResourceRef } from "../../../resources.js"
import {
  paperDocStatusSchema,
  paperStoredKindSchema,
} from "../../../paper-doc/paper.js"

export const operation = defineOperation({
  owner: "paper",
  name: "paper.outline",
  version: 2,
  kind: "read",
  description:
    "Read a bounded outline of a CV or Letter: its name, kind and status, its text blocks with ids, kinds and marks, the revision to pass as basedOn, and engine 2 when paper.edit takes commands. Pass blockIds to mark selected blocks.",
  label: "Read your Paper outline",
  readLabel: "Read your Paper outline",
  input: z
    .object({
      docId: z.string().uuid(),
      blockIds: z
        .array(z.string().regex(/^[A-Za-z0-9_-]{1,64}$/))
        .max(50)
        .optional(),
    })
    .strict(),
  publicResult: z
    .object({
      name: z.string(),
      kind: paperStoredKindSchema,
      status: paperDocStatusSchema,
      revision: z.number().int(),
      outline: z.string(),
      truncated: z.boolean(),
      engine: z.literal(2).optional(),
    })
    .strip(),
  coach: "auto",
  dependsOn: (input): readonly ResourceRef[] => [
    { name: "paper", coachFloor: "auto", entityId: input.docId },
  ],
})
