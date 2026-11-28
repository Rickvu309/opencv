import { changeSchema } from "../../../paper-doc/engine-change.js"
import { documentSchema } from "../../../paper-doc/engine-document.js"
import { z } from "zod"
import { defineOperation } from "../../../operation.js"
import type { ResourceRef } from "../../../resources.js"

export const saveChangesInputSchema = z.strictObject({
  docId: z.uuid(),
  client: z.string().min(1),
  base: z.int().nonnegative(),
  changes: z.array(changeSchema).min(1),
})

const headVersion = z.int().nonnegative()

const saveChangesResultSchema = z.union([
  z.strictObject({ ok: z.literal(true), head: headVersion }),
  z.strictObject({
    stale: z.literal(true),
    head: headVersion,
    since: z.array(changeSchema),
  }),
  z.strictObject({
    stale: z.literal(true),
    head: headVersion,
    compacted: z.strictObject({
      doc: documentSchema,
      version: headVersion,
      head: headVersion,
    }),
  }),
])

export const operation = defineOperation({
  owner: "paper",
  name: "paper.save",
  version: 3,
  kind: "command",
  description:
    "Save a tab's Paper changes or return the edits since its base version.",
  label: "Save your Paper",
  input: saveChangesInputSchema,
  publicResult: saveChangesResultSchema,
  coach: "never",
  destructive: false,
  idempotency: "none",
  writes: ({ docId }: { docId: string }): readonly ResourceRef[] => [
    { name: "paper", coachFloor: "auto", entityId: docId },
  ],
})
