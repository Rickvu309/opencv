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
  version: 3,
  kind: "read",
  description: "Download a saved CV or Letter as Word or PDF.",
  label: "Download your Paper",
  input: z
    .union([
      richExportInputSchema,
      z.strictObject({ docId: z.uuid(), format: z.enum(["docx", "pdf"]) }),
    ])
    .meta({ type: "object" }),
  publicResult: z.union([
    z.strictObject({
      docId: z.uuid(),
      kind: z.enum(["cv", "letter"]),
      name: z.string(),
      basis: nativeBasisSchema,
    }),
    z.strictObject({
      name: z.string(),
      contentType: z.enum([
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/pdf",
      ]),
      base64: z.string(),
    }),
  ]),
  coach: "never",
  dependsOn: (): readonly ResourceRef[] => [
    { name: "paper", coachFloor: "auto" },
  ],
})
