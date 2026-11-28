import { z } from "zod"
import { defineOperation } from "../../../operation.js"
import { paperLabelResource, type ResourceRef } from "../../../resources.js"
import {
  paperDocNameSchema,
  paperDocStatusSchema,
  paperStoredKindSchema,
} from "../../../paper-doc/paper.js"

const paperPatchSchema = z
  .object({
    name: paperDocNameSchema.optional(),
    isFavorite: z.boolean().optional(),
    status: paperDocStatusSchema.optional(),
  })
  .strict()
  .refine((patch) => Object.keys(patch).length > 0, {
    message: "Change the name, the favorite flag or the status",
  })

export const operation = defineOperation({
  owner: "paper",
  name: "paper.update",
  version: 1,
  kind: "command",
  description:
    "Rename a CV or Letter, or set its favorite flag or its status, in one patch. A Word page has only a name. The Coach may rename on its own; only the person sets the favorite flag and the status.",
  label: "Update your Paper",
  input: z
    .object({
      docId: z.string().uuid(),
      patch: paperPatchSchema,
    })
    .strict(),
  publicResult: z
    .object({
      id: z.string().uuid(),
      name: z.string(),
      kind: paperStoredKindSchema,
      status: paperDocStatusSchema,
      isFavorite: z.boolean(),
      format: z.enum(["word", "rich"]).optional(),
      updatedAt: z.string().datetime(),
    })
    .strip(),
  coach: "auto",
  destructive: false,
  idempotency: "keyed",
  writes: (input): readonly ResourceRef[] => [
    { name: "paper", coachFloor: "auto", entityId: input.docId },
    ...(input.patch.isFavorite !== undefined || input.patch.status !== undefined
      ? [{ ...paperLabelResource, entityId: input.docId }]
      : []),
  ],
})
