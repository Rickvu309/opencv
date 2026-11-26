import { z } from "zod"
import { defineOperation } from "../../../operation.js"
import type { ResourceRef } from "../../../resources.js"
import {
  nativeProvenanceSchema,
  nativeSyncOutputSchema,
  nativeWriterSchema,
} from "../../../paper-doc/native.js"
import { paperSyncInputSchema } from "../../../paper-doc/sync.js"

export const operation = defineOperation({
  owner: "paper",
  name: "paper.save",
  version: 1,
  kind: "command",
  description:
    "Exchange the rich editor's admitted changes for a CV or Letter with an explicit writer and provenance. An empty update reads the saved document.",
  label: "Save your Paper",
  input: paperSyncInputSchema
    .omit({ docId: true })
    .extend({
      docId: z.string().uuid(),
      writer: nativeWriterSchema,
      provenance: nativeProvenanceSchema,
    })
    .strict(),
  publicResult: nativeSyncOutputSchema.strip(),
  coach: "never",
  destructive: false,
  idempotency: "none",
  writes: (input): readonly ResourceRef[] => [
    { name: "paper", coachFloor: "auto", entityId: input.docId },
  ],
})
