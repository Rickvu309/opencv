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
    "List saved CVs and Letters with view library, or read one with docId to get its text and line handles (regions.paragraph) at a pinned revision. Follow nextCursor until it is null, keeping docId and at from the first page; a non-null nextCursor means more of the document remains. Locked regions are context only. To change lines, send paper_edit with setText, insert or delete against that revision as basedOn, then wait for the person to approve in OpenCV. Do not invent the person's experience or qualifications. view page returns the page as Word lines without a cursor.",
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
  delegate: { resource: "paper", access: "read" },
  dependsOn: (): readonly ResourceRef[] => [
    { name: "paper", coachFloor: "auto" },
  ],
})
