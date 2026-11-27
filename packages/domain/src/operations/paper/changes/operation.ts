import { z } from "zod"
import { defineOperation } from "../../../operation.js"
import { changeSchema } from "../../../paper-doc/engine-change.js"
import type { ResourceRef } from "../../../resources.js"

const version = z.int().nonnegative()

export const operation = defineOperation({
  owner: "paper",
  name: "paper.changes",
  version: 1,
  kind: "read",
  description: "Read saved Paper changes after a version.",
  label: "Read your Paper changes",
  readLabel: "Read your Paper changes",
  input: z.strictObject({ docId: z.uuid(), since: version }),
  publicResult: z.union([
    z.strictObject({ head: version, changes: z.array(changeSchema) }),
    z.strictObject({ head: version, compacted: z.literal(true) }),
  ]),
  coach: "never",
  dependsOn: (input): readonly ResourceRef[] => [
    { name: "paper", coachFloor: "auto", entityId: input.docId },
  ],
})
