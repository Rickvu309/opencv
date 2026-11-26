import { z } from "zod"
import { defineOperation } from "../../../operation.js"
import type { ResourceRef } from "../../../resources.js"

export const operation = defineOperation({
  owner: "paper",
  name: "paper.delete",
  version: 1,
  kind: "command",
  description:
    "Delete a CV or Letter. The person approves it first. A deleted Word page stays in the trash and Undo brings it back; a rich Paper is deleted for good.",
  label: "Delete this Paper",
  input: z.object({ docId: z.string().uuid() }).strict(),
  publicResult: z
    .object({
      id: z.string().uuid(),
      name: z.string().optional(),
    })
    .strip(),
  coach: "confirm",
  destructive: true,
  idempotency: "keyed",
  writes: (input): readonly ResourceRef[] => [
    { name: "paper", coachFloor: "auto", entityId: input.docId },
  ],
})
