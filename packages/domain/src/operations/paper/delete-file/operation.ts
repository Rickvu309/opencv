import { z } from "zod"
import { defineOperation } from "../../../operation.js"
import type { ResourceRef } from "../../../resources.js"

export const operation = defineOperation({
  owner: "paper",
  name: "paper.deleteFile",
  version: 1,
  kind: "command",
  description:
    "Delete an uploaded file. A photo still used by a CV, the Profile or an Undo cannot be deleted.",
  input: z.object({ fileId: z.string().uuid() }).strict(),
  publicResult: z.object({ fileId: z.string().uuid() }).strip(),
  coach: "never",
  destructive: true,
  idempotency: "keyed",
  writes: (input): readonly ResourceRef[] => [
    { name: "file", coachFloor: "auto", entityId: input.fileId },
  ],
})
