import { z } from "zod"
import { defineOperation } from "../../../operation.js"
import type { ResourceRef } from "../../../resources.js"
import {
  paperPackageMetadataSchema,
  paperPackageReadInputSchema,
  paperPackageReadSchema,
  paperWordReadSchema,
} from "../../../paper-doc/paper-package.js"
import { wordPageSchema } from "../../../paper-doc/paper-word.js"
import {
  nativeProvenanceSchema,
  nativeWriterSchema,
} from "../../../paper-doc/native.js"
import { paperStoredKindSchema } from "../../../paper-doc/paper.js"

export const operation = defineOperation({
  owner: "paper",
  name: "paper.read",
  version: 1,
  kind: "read",
  description:
    "List saved CVs and Letters with view library, or read one with docId to get its text and line handles (regions.paragraph) at a pinned revision. Follow nextCursor until it is null, keeping docId and at from the first page; a non-null nextCursor means more of the document remains. Locked regions are context only. To change lines, send paper_edit with setText, insert or delete against that revision as basedOn, then wait for the person to approve in OpenCV. Do not invent the person's experience or qualifications. view page returns the page as Word lines without a cursor. view lines returns the document as paragraphs with their handles, read in parts by following nextCursor. view trash says whether a deleted Word page can be brought back. view info gives a document's name, kind, format and, for a rich document, its provenance.",
  label: "Read your Paper",
  readLabel: "Read your Paper",
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
      z
        .object({
          view: z.literal("lines"),
          docId: z.string().uuid(),
          at: z.string().uuid().optional(),
          cursor: z.string().min(1).max(2048).optional(),
        })
        .strict(),
      z
        .object({
          view: z.literal("trash"),
          docId: z.string().uuid(),
        })
        .strict(),
      z
        .object({
          view: z.literal("info"),
          docId: z.string().uuid(),
          writer: nativeWriterSchema.optional(),
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
    paperWordReadSchema,
    wordPageSchema,
    z.object({ docId: z.string().uuid(), deleted: z.boolean() }).strict(),
    z
      .object({
        id: z.string().uuid(),
        name: z.string(),
        kind: paperStoredKindSchema,
        format: z.enum(["word", "prose", "rich"]),
        provenance: nativeProvenanceSchema.optional(),
        updatedAt: z.string().datetime().optional(),
      })
      .strict(),
  ]),
  coach: "never",
  delegate: { resource: "paper", access: "read" },
  dependsOn: (): readonly ResourceRef[] => [
    { name: "paper", coachFloor: "auto" },
  ],
})
