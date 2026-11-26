import { z } from "zod"
import { defineOperation } from "../../../operation.js"
import type { ResourceRef } from "../../../resources.js"
import { nativeWriterSchema } from "../../../paper-doc/native.js"
import { paperStoredKindSchema } from "../../../paper-doc/paper.js"

export const operation = defineOperation({
  owner: "paper",
  name: "paper.duplicate",
  version: 1,
  kind: "command",
  description:
    "Make a copy of a CV or Letter named Copy of its name. Undo deletes the copy while its name is unchanged.",
  input: z
    .object({
      docId: z.string().uuid(),
      writer: nativeWriterSchema.optional(),
    })
    .strict(),
  publicResult: z
    .object({
      id: z.string().uuid(),
      name: z.string(),
      kind: paperStoredKindSchema,
      format: z.enum(["word", "rich"]).optional(),
    })
    .strip(),
  coach: "auto",
  destructive: false,
  idempotency: "keyed",
  writes: (): readonly ResourceRef[] => [{ name: "paper", coachFloor: "auto" }],
})
