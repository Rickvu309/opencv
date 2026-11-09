import { z } from "zod"
import { defineOperation } from "../../../operation.js"
import type { ResourceRef } from "../../../resources.js"
import { paperImportInputSchema } from "../../../paper.js"
import { paperPackageMetadataSchema } from "../../../paper-package.js"

export const operation = defineOperation({
  owner: "paper",
  name: "paper.import",
  version: 1,
  kind: "command",
  description: "Import an uploaded file or publish a staged Word document.",
  input: z
    .union([
      paperImportInputSchema.extend({ fileId: z.string().uuid() }),
      z
        .object({
          generation: z.literal("package"),
          stageId: z.string().uuid(),
        })
        .strict(),
    ])
    .meta({ type: "object" }),
  publicResult: z.union([
    z
      .object({
        id: z.string().uuid(),
        name: z.string(),
        kind: z.enum(["cv", "letter", "proof"]),
        contentVersion: z.number().int(),
        sourceFileId: z.string().uuid().nullable(),
      })
      .strip(),
    paperPackageMetadataSchema.strip(),
  ]),
  coach: "auto",
  destructive: false,
  idempotency: "keyed",
  writes: (): readonly ResourceRef[] => [{ name: "paper", coachFloor: "auto" }],
})
