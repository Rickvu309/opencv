import { z } from "zod"
import { defineOperation } from "../../../operation.js"
import type { ResourceRef } from "../../../resources.js"
import { paperStoredKindSchema } from "../../../paper-doc/paper.js"

const listedPaper = z.object({ id: z.string(), name: z.string() }).passthrough()

export const operation = defineOperation({
  owner: "paper",
  name: "paper.list",
  version: 1,
  kind: "read",
  description:
    "List documents. A Word page is listed without a document body: read its text with paper_outline.",
  label: "Look at your Paper",
  readLabel: "Looked at your Paper",
  input: z
    .object({
      query: z.string().optional(),
      kind: paperStoredKindSchema.optional(),
    })
    .strict(),
  publicResult: z.array(listedPaper),
  coach: "auto",
  dependsOn: (): readonly ResourceRef[] => [
    { name: "paper", coachFloor: "auto" },
  ],
})
