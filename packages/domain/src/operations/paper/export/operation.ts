import { z } from "zod"
import { defineOperation } from "../../../operation.js"
import type { ResourceRef } from "../../../resources.js"
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
  version: 2,
  kind: "read",
  description:
    "Qualify an exact saved CV or Letter for Word download with its writer and basis.",
  label: "Download your Paper as Word",
  input: richExportInputSchema,
  publicResult: z
    .object({
      docId: z.string().uuid(),
      kind: z.enum(["cv", "letter"]),
      name: z.string(),
      basis: nativeBasisSchema,
    })
    .strict(),
  coach: "never",
  dependsOn: (): readonly ResourceRef[] => [
    { name: "paper", coachFloor: "auto" },
  ],
})
