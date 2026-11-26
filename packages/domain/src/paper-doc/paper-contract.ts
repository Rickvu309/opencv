import { z } from "zod"

import { commandContract, commandEntry } from "../contract.js"
import { paperIdSchema } from "../ids.js"
import { nativeBasisSchema, nativeWriterSchema } from "./native.js"
import { richEditOutputSchema, richTextEditsSchema } from "./paper-rich-edit.js"
import {
  paperPackageEditResultSchema,
  paperPackageEditsSchema,
} from "./paper-package.js"
import { wordConfirmedOpsSchema } from "./paper-word.js"
import type { QueryRef } from "../queries.js"

export * from "./paper-contract-views.js"

type DocInput = { docId: z.output<typeof paperIdSchema> }

const listChanged = (): QueryRef[] => [{ query: "paper.list" }]

const docChanged = (input: DocInput): QueryRef[] => [
  { query: "paper.outline", input: { docId: input.docId } },
  ...listChanged(),
]

export const paperContract = commandContract({
  "paper.edit": commandEntry({
    delegate: { resource: "paper", access: "proposal" },
    description:
      "Propose a change to a CV or Letter. Nothing is written until the person approves it in OpenCV; a pending result means the document is unchanged. On a saved Word document, read it first (paper_read for an agent, paper.outline for the Coach), pass its revision as basedOn and address lines by handle: setText (handle and the whole new text of that line, including first words on an empty line), insert (after a handle, or null for the start of the page, and the new line's text) and delete (handle). Send several operations in one edit to change several lines. Use only facts the person gave; do not invent the person's experience or qualifications. If the document changed after that read, the edit or its approval is refused and the document stays as it is; read it again and propose again. On a rich CV or Letter, read paper.outline first and copy its revision as basedOn and its nativeBasis unchanged, and send the rich editor's writer. Address a text block by its id with a UTF-16 range from and to and the exact before text: replaceText replaces that range and keeps the surrounding formatting, and formatText merges only the marks you give. Tables, photos and page layout cannot be edited this way.",
    input: z
      .object({
        docId: paperIdSchema,
        basedOn: z.union([z.number().int().min(0), z.string().uuid()]),
        writer: nativeWriterSchema.optional(),
        nativeBasis: nativeBasisSchema.optional(),
        edits: z.union([
          richTextEditsSchema,
          paperPackageEditsSchema,
          wordConfirmedOpsSchema,
        ]),
      })
      .strict()
      .superRefine((input, ctx) => {
        const rich = richTextEditsSchema.safeParse(input.edits).success
        if (rich === (typeof input.basedOn === "string"))
          ctx.addIssue({
            code: "custom",
            message: "This edit does not match the saved document.",
            path: ["edits"],
          })
      }),
    output: z.union([richEditOutputSchema, paperPackageEditResultSchema]),
    coach: "confirm",
    destructive: false,
    step: () => "Edit the document",
    invalidates: (input) => docChanged(input),
  }),
})

export type PaperContract = typeof paperContract
