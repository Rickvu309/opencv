import { z } from "zod"
import { defineOperation } from "../../../operation.js"
import type { ResourceRef } from "../../../resources.js"
import { paperPackageMetadataSchema } from "../../../paper-doc/paper-package.js"
import {
  nativeBasisSchema,
  nativeWriterSchema,
} from "../../../paper-doc/native.js"

export const richExportInputSchema = z
  .object({
    docId: z.string().uuid(),
    kind: z.enum(["cv", "letter"]),
    writer: nativeWriterSchema,
    basis: nativeBasisSchema,
  })
  .strict()

export const operation = defineOperation({
  owner: "paper",
  name: "paper.export",
  version: 1,
  kind: "read",
  description:
    "Get the download for an exact saved Word revision without conversion, or qualify an exact saved rich CV or Letter for Word download with its writer and basis.",
  label: "Download your Paper as Word",
  input: z
    .union([
      z
        .object({
          docId: z.string().uuid(),
          at: paperPackageMetadataSchema.shape.revision,
        })
        .strict(),
      richExportInputSchema,
    ])
    .meta({ type: "object" }),
  publicResult: z.union([
    paperPackageMetadataSchema
      .extend({
        downloadPath: z.string().max(200).startsWith("/api/paper/packages/"),
      })
      .strict(),
    z
      .object({
        docId: z.string().uuid(),
        kind: z.enum(["cv", "letter"]),
        name: z.string(),
        basis: nativeBasisSchema,
      })
      .strict(),
  ]),
  coach: "never",
  dependsOn: (): readonly ResourceRef[] => [
    { name: "paper", coachFloor: "auto" },
  ],
})
