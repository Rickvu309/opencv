import { z } from "zod"
import { defineOperation } from "../../../operation.js"
import type { ResourceRef } from "../../../resources.js"
import {
  nativeBasisSchema,
  nativeProvenanceSchema,
  nativeWriterSchema,
} from "../../../paper-doc/native.js"
import { paperStoredKindSchema } from "../../../paper-doc/paper.js"

export const operation = defineOperation({
  owner: "paper",
  name: "paper.read",
  version: 2,
  kind: "read",
  description:
    "List saved CVs and Letters with view library, or read one with docId to get its text: an outline of text blocks with their ids, the revision to pass as basedOn and, for older Papers, the nativeBasis to copy unchanged into paper_edit. engine 2 means paper_edit takes commands with expect. Do not invent the person's experience or qualifications. view info gives a document's name, kind, format and provenance.",
  label: "Read your Paper",
  readLabel: "Read your Paper",
  input: z
    .union([
      z.object({ view: z.literal("library") }).strict(),
      z
        .object({
          view: z.literal("info"),
          docId: z.string().uuid(),
          writer: nativeWriterSchema.optional(),
        })
        .strict(),
      z.object({ docId: z.string().uuid() }).strict(),
    ])
    .meta({ type: "object" }),
  publicResult: z.union([
    z
      .object({
        items: z
          .array(
            z
              .object({
                docId: z.string().uuid(),
                name: z.string(),
                kind: paperStoredKindSchema,
              })
              .strict()
          )
          .max(200),
        next: z.null(),
      })
      .strict(),
    z
      .object({
        id: z.string().uuid(),
        name: z.string(),
        kind: paperStoredKindSchema,
        format: z.enum(["prose", "rich"]),
        provenance: nativeProvenanceSchema.optional(),
        updatedAt: z.string().datetime().optional(),
      })
      .strict(),
    z
      .object({
        docId: z.string().uuid(),
        name: z.string(),
        kind: paperStoredKindSchema,
        revision: z.number().int(),
        nativeBasis: nativeBasisSchema.optional(),
        outline: z.string(),
        truncated: z.boolean(),
        engine: z.literal(2).optional(),
      })
      .strict(),
  ]),
  coach: "never",
  delegateRefusal:
    "This connection cannot read documents. Stop and ask the person to reconnect.",
  delegate: { resource: "paper", access: "read" },
  dependsOn: (): readonly ResourceRef[] => [
    { name: "paper", coachFloor: "auto" },
  ],
})
