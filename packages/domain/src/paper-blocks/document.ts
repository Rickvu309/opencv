import { z } from "zod"

import { bulletedListBlock } from "./blocks/bulleted-list.js"
import { dividerBlock } from "./blocks/divider.js"
import { educationEntryBlock } from "./blocks/education-entry.js"
import { experienceEntryBlock } from "./blocks/experience-entry.js"
import { headingBlock } from "./blocks/heading.js"
import { numberedListBlock } from "./blocks/numbered-list.js"
import { skillsGroupBlock } from "./blocks/skills-group.js"
import { textBlock } from "./blocks/text.js"
import { blockIdSchema } from "./schema.js"

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

export const cvBlockSchema = z.discriminatedUnion("type", [
  textBlock.schema,
  headingBlock.schema,
  bulletedListBlock.schema,
  numberedListBlock.schema,
  dividerBlock.schema,
  experienceEntryBlock.schema,
  educationEntryBlock.schema,
  skillsGroupBlock.schema,
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
        photo: z.string().optional(),
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
