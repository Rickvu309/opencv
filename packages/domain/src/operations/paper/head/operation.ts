import { z } from "zod"
import { defineOperation } from "../../../operation.js"
import { documentSchema } from "../../../paper-doc/engine-document.js"
import type { ResourceRef } from "../../../resources.js"

export const operation = defineOperation({
  owner: "paper",
  name: "paper.head",
  version: 1,
  kind: "read",
  description: "Read the saved Paper document and its version for a tab.",
  label: "Open your Paper",
  readLabel: "Open your Paper",
  input: z.strictObject({ docId: z.uuid() }),
  publicResult: z.strictObject({
    doc: documentSchema,
    version: z.int().nonnegative(),
  }),
  coach: "never",
  dependsOn: (input): readonly ResourceRef[] => [
    { name: "paper", coachFloor: "auto", entityId: input.docId },
  ],
})
