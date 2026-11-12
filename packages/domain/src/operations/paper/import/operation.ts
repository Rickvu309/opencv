import { z } from "zod"
import { defineOperation } from "../../../operation.js"
import type { ResourceRef } from "../../../resources.js"
import { paperPackageMetadataSchema } from "../../../paper-package.js"

export const operation = defineOperation({
  owner: "paper",
  name: "paper.import",
  version: 1,
  kind: "command",
  description: "Publish an uploaded file as a Word document.",
  input: z
    .object({
      generation: z.literal("package"),
      stageId: z.string().uuid(),
    })
    .strict(),
  publicResult: paperPackageMetadataSchema.strip(),
  coach: "auto",
  destructive: false,
  idempotency: "keyed",
  writes: (): readonly ResourceRef[] => [{ name: "paper", coachFloor: "auto" }],
})
