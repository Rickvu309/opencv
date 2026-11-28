import { z } from "zod"
import { defineOperation } from "../../../operation.js"
import type { ResourceRef } from "../../../resources.js"

export const operation = defineOperation({
  owner: "paper",
  name: "paper.export",
  version: 3,
  kind: "read",
  description: "Download a saved CV or Letter as Word or PDF.",
  label: "Download your Paper",
  input: z.strictObject({ docId: z.uuid(), format: z.enum(["docx", "pdf"]) }),
  publicResult: z.strictObject({
    name: z.string(),
    contentType: z.enum([
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/pdf",
    ]),
    base64: z.string(),
  }),
  coach: "never",
  dependsOn: (): readonly ResourceRef[] => [
    { name: "paper", coachFloor: "auto" },
  ],
})
