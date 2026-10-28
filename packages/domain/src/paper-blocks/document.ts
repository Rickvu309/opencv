import { z } from "zod"

import { paperPhotoValueSchema } from "../paper.js"
import { blockRegistry } from "./registry.js"
import { blockIdSchema } from "./schema.js"

type SchemaEntry = { readonly schema: z.ZodType }

type SchemasOf<T extends readonly SchemaEntry[]> = {
  [I in keyof T]: T[I]["schema"]
}

function registrySchemas<const T extends readonly SchemaEntry[]>(entries: T) {
  return entries.map((entry) => entry.schema) as SchemasOf<T>
}

const blockSchemas = registrySchemas(blockRegistry)

/** A discriminated union of whatever entries you pass. A filtered copy drops that type. */
export function cvBlockSchemaFrom<const T extends readonly SchemaEntry[]>(
  entries: T
) {
  const schemas = registrySchemas(entries)
  if (schemas.length < 2) {
    throw new Error("A block schema needs two types")
  }
  return z.discriminatedUnion("type", schemas as typeof blockSchemas)
}

export const cvBlockSchema = z.discriminatedUnion("type", blockSchemas)
export type CvBlock = z.infer<typeof cvBlockSchema>

export const cvSectionKindSchema = z.enum([
  "summary",
  "experience",
  "education",
  "skills",
  "projects",
  "activities",
  "awards",
  "languages",
])

export const cvBlockDocumentSchema = z
  .object({
    version: z.literal(2),
    header: z
      .object({
        name: z.string(),
        email: z.string(),
        phone: z.string(),
        city: z.string(),
        linkedin: z.string(),
        photo: paperPhotoValueSchema.optional(),
      })
      .strict(),
    sections: z.array(
      z
        .object({
          id: blockIdSchema,
          kind: cvSectionKindSchema,
          blocks: z.array(cvBlockSchema),
        })
        .strict()
    ),
  })
  .strict()

export type CvSectionKind = z.infer<typeof cvSectionKindSchema>
export type CvBlockDocument = z.infer<typeof cvBlockDocumentSchema>

export function isCvBlockDocument(value: unknown): value is CvBlockDocument {
  return cvBlockDocumentSchema.safeParse(value).success
}

/** Empty header strings and the three starter sections. Placeholders stay in the editor. */
export function blankBlockDocument(): CvBlockDocument {
  return {
    version: 2,
    header: {
      name: "",
      email: "",
      phone: "",
      city: "",
      linkedin: "",
    },
    sections: [
      { id: "section-experience", kind: "experience", blocks: [] },
      { id: "section-education", kind: "education", blocks: [] },
      { id: "section-skills", kind: "skills", blocks: [] },
    ],
  }
}

export function makeIds() {
  let n = 0
  return () => {
    n += 1
    return `cv-${n}`
  }
}
