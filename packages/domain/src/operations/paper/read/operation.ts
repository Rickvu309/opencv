import { z } from "zod"
import { defineOperation } from "../../../operation.js"
import type { ResourceRef } from "../../../resources.js"
import {
  paperPackageMetadataSchema,
  paperPackageReadInputSchema,
  paperPackageReadSchema,
} from "../../../paper-package.js"
import { wordPageSchema } from "../../../paper-word.js"

export const operation = defineOperation({
  owner: "paper",
  name: "paper.read",
  version: 1,
  kind: "read",
  description:
    "List saved Word documents, read a page pinned to its document and revision, or read the page as Word lines.",
  input: z
    .union([
      z
        .object({
          view: z.literal("library"),
          after: z.string().uuid().optional(),
        })
        .strict(),
      z
        .object({
          view: z.literal("page"),
          docId: z.string().uuid(),
          at: z.string().uuid().optional(),
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
    wordPageSchema,
  ]),
  coach: "never",
  dependsOn: (): readonly ResourceRef[] => [
    { name: "paper", coachFloor: "auto" },
  ],
})
