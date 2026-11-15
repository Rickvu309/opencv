import { z } from "zod"
import { nodeIdSchema } from "./nodes.js"
import {
  inlinePatchSchema,
  paragraphPatchSchema,
  paragraphSchema,
  inlineSchema,
  pageSchema,
  pagePropertiesSchema,
  styleIdSchema,
} from "./presentation-values.js"
import { styleSchema } from "./presentation-styles.js"
import { formatRunsSchema } from "./native-formatting.js"
export const formatTargetSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("body"), blockId: nodeIdSchema }).strict(),
  z
    .object({
      kind: z.literal("cv-field"),
      ownerId: nodeIdSchema,
      fieldId: nodeIdSchema,
      fieldKey: z.enum([
        "name",
        "headline",
        "email",
        "phone",
        "city",
        "linkedin",
        "title",
        "role",
        "company",
        "period",
        "location",
        "school",
        "degree",
        "detail",
        "label",
        "item",
      ]),
      itemId: nodeIdSchema.optional(),
    })
    .strict(),
])
export type FormatTarget = z.infer<typeof formatTargetSchema>
export const formatChangeSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("document-page"),
      expected: pageSchema,
      values: pagePropertiesSchema.partial().strict(),
    })
    .strict(),
  z
    .object({
      kind: z.literal("document-inline"),
      expected: inlineSchema,
      values: inlinePatchSchema,
    })
    .strict(),
  z
    .object({
      kind: z.literal("document-paragraph"),
      expected: paragraphSchema,
      values: paragraphPatchSchema,
    })
    .strict(),
  z
    .object({
      kind: z.literal("named-style"),
      id: styleIdSchema,
      expected: styleSchema.nullable(),
      values: styleSchema.nullable(),
    })
    .strict(),
  z
    .object({
      kind: z.literal("inline"),
      range: z
        .object({
          target: formatTargetSchema,
          from: z.number().int().nonnegative(),
          to: z.number().int().positive(),
        })
        .strict()
        .refine((r) => r.from < r.to),
      expected: formatRunsSchema,
      values: inlinePatchSchema,
    })
    .strict(),
  z
    .object({
      kind: z.literal("paragraph"),
      target: formatTargetSchema,
      expected: paragraphSchema,
      values: paragraphPatchSchema,
    })
    .strict(),
])
export type FormatChange = z.infer<typeof formatChangeSchema>
