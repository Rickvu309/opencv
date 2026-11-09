import { z } from "zod"
import { defineOperation } from "../../../operation.js"
import type { ResourceRef } from "../../../resources.js"
import {
  paperPackageMetadataSchema,
  paperPackageReadInputSchema,
  paperPackageReadSchema,
} from "../../../paper-package.js"

export const operation = defineOperation({
  owner: "paper",
  name: "paper.read",
  version: 1,
  kind: "read",
  description:
    "List saved Word documents or read a page pinned to its document and revision.",
  input: z
    .union([
      z
        .object({
          view: z.literal("library"),
          after: z.string().uuid().optional(),
        })
        .strict(),
      paperPackageReadInputSchema,
    ])
    .meta({ type: "object" }),
  publicResult: z.union([
    z
      .object({
        items: z.array(paperPackageMetadataSchema).max(50),
        next: z.string().uuid().nullable(),
      })
      .strict(),
    paperPackageReadSchema,
  ]),
  coach: "never",
  dependsOn: (): readonly ResourceRef[] => [
    { name: "paper", coachFloor: "auto" },
  ],
})
