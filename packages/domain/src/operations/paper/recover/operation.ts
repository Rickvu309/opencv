import { z } from "zod"
import { defineOperation } from "../../../operation.js"
import type { ResourceRef } from "../../../resources.js"
import { paperStoredKindSchema } from "../../../paper-doc/paper.js"

export const operation = defineOperation({
  owner: "paper",
  name: "paper.recover",
  version: 1,
  kind: "command",
  description:
    "Bring back a deleted Word page with its content and its Job link. Read paper.read with view trash to see whether a page can be brought back.",
  input: z.object({ docId: z.string().uuid() }).strict(),
  publicResult: z
    .object({
      id: z.string().uuid(),
      name: z.string(),
      kind: paperStoredKindSchema,
      format: z.enum(["word", "rich"]).optional(),
      updatedAt: z.string().datetime(),
    })
    .strip(),
  coach: "never",
  destructive: false,
  idempotency: "keyed",
  writes: (input): readonly ResourceRef[] => [
    { name: "paper", coachFloor: "auto", entityId: input.docId },
  ],
})
