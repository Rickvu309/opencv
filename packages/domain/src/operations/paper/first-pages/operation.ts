import { z } from "zod"
import { defineOperation } from "../../../operation.js"
import { layoutPageSchema } from "../../../paper-doc/engine-page.js"
import type { ResourceRef } from "../../../resources.js"

export const operation = defineOperation({
  owner: "paper",
  name: "paper.firstPages",
  version: 1,
  kind: "read",
  description: "Read the stored first pages for a hand of Paper library cards.",
  label: "Read your Paper previews",
  readLabel: "Read your Paper previews",
  input: z.strictObject({ ids: z.array(z.uuid()).max(16) }),
  publicResult: z.array(
    z.strictObject({ id: z.uuid(), page: layoutPageSchema })
  ),
  coach: "never",
  dependsOn: ({ ids }): readonly ResourceRef[] =>
    ids.map((entityId) => ({ name: "paper", coachFloor: "auto", entityId })),
})
