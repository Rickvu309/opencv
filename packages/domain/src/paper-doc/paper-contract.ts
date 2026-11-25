import { z } from "zod"

import { commandContract, commandEntry } from "../contract.js"
import { jobIdSchema, paperIdSchema, parsePaperId } from "../ids.js"
import {
  nativeBasisSchema,
  nativeWriterSchema,
  nativeSyncInputSchema,
  nativeSyncOutputSchema,
} from "./native.js"
import { richEditOutputSchema, richTextEditsSchema } from "./paper-rich-edit.js"
import { paperCanvasCommitSchema } from "./paper-canvas.js"
import { paperStartInputSchema } from "./paper-start.js"
import {
  paperPackageEditResultSchema,
  paperPackageEditsSchema,
} from "./paper-package.js"
import { wordConfirmedOpsSchema } from "./paper-word.js"
import {
  paperDocNameSchema,
  paperDuplicateInputSchema,
  paperStoredKindSchema,
} from "./paper.js"
import type { QueryRef } from "../queries.js"

export * from "./paper-contract-views.js"
import {
  paperDocumentInfoSchema,
  paperViewSchema,
} from "./paper-contract-views.js"

type DocInput = { docId: z.output<typeof paperIdSchema> }

const listChanged = (): QueryRef[] => [{ query: "paper.list" }]

const docChanged = (input: DocInput): QueryRef[] => [
  { query: "paper.outline", input: { docId: input.docId } },
  ...listChanged(),
]

const paperCreateInputSchema = z
  .object({
    kind: paperStoredKindSchema,
    format: z.literal("rich").optional(),
    name: paperDocNameSchema.optional(),
    jobId: jobIdSchema.optional(),
  })
  .strict()

export const paperContract = commandContract({
  "paper.create": commandEntry({
    description:
      "Create a CV or letter. The new document is one empty paragraph that opens the full editor.",
    input: paperCreateInputSchema,
    output: z.union([paperViewSchema, paperDocumentInfoSchema]),
    coach: "never",
    destructive: false,
    step: (input) => `Create a ${input.kind === "cv" ? "CV" : "letter"}`,
    invalidates: listChanged,
  }),
  "paper.start": commandEntry({
    description:
      "Start a new CV or Letter as a Word page. A CV starts from a template whose lines are bracketed placeholders such as [Your name] under fixed headings; a Letter starts blank. Pass jobId when it is for a Job. The person approves the new page first, because a Word page cannot be deleted yet. It writes none of your words: after it is made, read the page with paper.outline and propose its words with paper.edit, which the person approves. Replace a placeholder only with facts the person gave in their Profile or this Chat; never invent experience or qualifications.",
    input: paperStartInputSchema,
    output: paperPackageEditResultSchema,
    coach: "confirm",
    destructive: false,
    step: (input) =>
      `Start a new ${input.kind === "cv" ? "CV" : "Letter"} in Paper. You approve its words next.`,
    invalidates: listChanged,
  }),
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
  "paper.canvas": commandEntry({
    description:
      "Start a Word page (blank, from a template, or with the person's drafted lines, optionally named and linked to a Job), or save what the person wrote as one batch of line changes.",
    input: paperCanvasCommitSchema,
    output: paperPackageEditResultSchema,
    idempotency: "keyed",
    coach: "never",
    destructive: false,
    step: () => "Write on the page",
    invalidates: (input) =>
      input.op === "mint"
        ? listChanged()
        : [
            {
              query: "paper.outline",
              input: { docId: parsePaperId(input.batch.doc) },
            },
            ...listChanged(),
          ],
  }),
  "paper.save": commandEntry({
    description:
      "Exchange admitted native document changes with explicit writer and provenance.",
    input: nativeSyncInputSchema,
    output: nativeSyncOutputSchema,
    idempotency: "none",
    coach: "never",
    destructive: false,
    step: () => "Sync the document",
    invalidates: (input) => [
      { query: "paper.outline", input: { docId: input.docId } },
      ...listChanged(),
    ],
  }),
  "paper.duplicate": commandEntry({
    description: "Duplicate a document.",
    input: paperDuplicateInputSchema.extend({
      writer: nativeWriterSchema.optional(),
    }),
    output: paperViewSchema,
    coach: "auto",
    destructive: false,
    step: () => "Duplicate the document",
    invalidates: listChanged,
  }),
})

export type PaperContract = typeof paperContract
