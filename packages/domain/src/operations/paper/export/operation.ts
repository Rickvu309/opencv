import { z } from "zod"
import { defineOperation } from "../../../operation.js"
import type { ResourceRef } from "../../../resources.js"
import { paperPackageMetadataSchema } from "../../../paper-package.js"

export const operation = defineOperation({
  owner: "paper",
  name: "paper.export",
  version: 1,
  kind: "read",
  description:
    "Get the download for an exact saved Word revision without conversion.",
  input: z
    .object({
      docId: z.string().uuid(),
      at: paperPackageMetadataSchema.shape.revision,
    })
    .strict(),
  publicResult: paperPackageMetadataSchema
    .extend({
      downloadPath: z.string().max(200).startsWith("/api/paper/packages/"),
    })
    .strict(),
  coach: "never",
  dependsOn: (): readonly ResourceRef[] => [
    { name: "paper", coachFloor: "auto" },
  ],
})
