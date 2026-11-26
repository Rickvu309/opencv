import { defineOperation } from "../../../operation.js"
import type { ResourceRef } from "../../../resources.js"
import { paperCanvasCommitSchema } from "../../../paper-doc/paper-canvas.js"
import { paperPackageEditResultSchema } from "../../../paper-doc/paper-package.js"

export const operation = defineOperation({
  owner: "paper",
  name: "paper.canvas",
  version: 1,
  kind: "command",
  description:
    "Start a Word page (blank, from a template, or with the person's drafted lines, optionally named and linked to a Job), or save what the person wrote as one batch of line changes.",
  input: paperCanvasCommitSchema,
  publicResult: paperPackageEditResultSchema.strip(),
  coach: "never",
  destructive: false,
  idempotency: "keyed",
  writes: (input): readonly ResourceRef[] =>
    input.op === "write"
      ? [{ name: "paper", coachFloor: "auto", entityId: input.batch.doc }]
      : [{ name: "paper", coachFloor: "auto" }],
})
