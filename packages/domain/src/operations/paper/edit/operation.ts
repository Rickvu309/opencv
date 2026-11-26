import { z } from "zod"
import { defineOperation } from "../../../operation.js"
import type { ResourceRef } from "../../../resources.js"
import {
  nativeBasisSchema,
  nativeWriterSchema,
} from "../../../paper-doc/native.js"
import {
  paperPackageEditResultSchema,
  paperPackageEditsSchema,
} from "../../../paper-doc/paper-package.js"
import { formatRunSchema } from "../../../paper-doc/native-formatting.js"
import { richTextEditsSchema } from "../../../paper-doc/paper-rich-edit.js"
import { wordConfirmedOpsSchema } from "../../../paper-doc/paper-word.js"

const publicRun = formatRunSchema
  .omit({ href: true })
  .extend({ href: z.string().optional() })
  .strict()

const publicRichEdit = z
  .object({
    format: z.literal("rich"),
    docId: z.string().uuid(),
    name: z.string(),
    changes: z
      .array(
        z
          .object({
            blockId: z.string(),
            before: z.array(publicRun),
            after: z.array(publicRun),
          })
          .strict()
      )
      .min(1)
      .max(30),
    revision: z.number().int().nonnegative(),
    editId: z.string().uuid(),
  })
  .strip()

export const operation = defineOperation({
  owner: "paper",
  name: "paper.edit",
  version: 1,
  kind: "command",
  description:
    "Propose a change to a CV or Letter. Nothing is written until the person approves it in OpenCV; a pending result means the document is unchanged. On a saved Word document, read it first (paper_read for an agent, paper.outline for the Coach), pass its revision as basedOn and address lines by handle: setText (handle and the whole new text of that line, including first words on an empty line), insert (after a handle, or null for the start of the page, and the new line's text) and delete (handle). Send several operations in one edit to change several lines. Use only facts the person gave; do not invent the person's experience or qualifications. If the document changed after that read, the edit or its approval is refused and the document stays as it is; read it again and propose again. On a rich CV or Letter, read paper.outline first and copy its revision as basedOn and its nativeBasis unchanged, and send the rich editor's writer. Address a text block by its id with a UTF-16 range from and to and the exact before text: replaceText replaces that range and keeps the surrounding formatting, and formatText merges only the marks you give. Tables, photos and page layout cannot be edited this way.",
  label: "Edit your Paper",
  input: z
    .object({
      docId: z.string().uuid(),
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
  publicResult: z.union([publicRichEdit, paperPackageEditResultSchema.strip()]),
  coach: "confirm",
  delegate: { resource: "paper", access: "proposal" },
  destructive: false,
  idempotency: "keyed",
  writes: (input): readonly ResourceRef[] => [
    { name: "paper", coachFloor: "auto", entityId: input.docId },
  ],
})
