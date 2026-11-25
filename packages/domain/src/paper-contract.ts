import { z } from "zod"

import { commandContract, commandEntry } from "./contract.js"
import {
  fileIdSchema,
  jobIdSchema,
  paperIdSchema,
  parsePaperId,
} from "./ids.js"
import {
  nativeBasisSchema,
  nativeWriterSchema,
  nativeSyncInputSchema,
  nativeSyncOutputSchema,
} from "./paper-doc/native.js"
import {
  paperEditOutcomeSchema,
  paperEditsSchema,
} from "./paper-doc/edits-schema.js"
import { paperCanvasCommitSchema } from "./paper-canvas.js"
import { paperStartInputSchema } from "./paper-start.js"
import {
  paperPackageEditResultSchema,
  paperPackageEditsSchema,
} from "./paper-package.js"
import { wordConfirmedOpsSchema } from "./paper-word.js"
import {
  paperDeleteFileInputSchema,
  paperDeleteInputSchema,
  paperDocNameSchema,
  paperDuplicateInputSchema,
  paperRenameInputSchema,
  paperSetStatusCommandInputSchema,
  paperStoredKindSchema,
} from "./paper.js"
import type { QueryRef } from "./queries.js"

export * from "./paper-contract-views.js"
import {
  paperDocumentInfoSchema,
  paperViewSchema,
} from "./paper-contract-views.js"

const editIdSchema = z.string().min(1).max(64)
const MAX_RECEIPT_CHANGES = 30

const paperChangeSchema = z
  .object({
    blockId: z.string(),
    change: z.enum(["added", "changed", "moved", "removed"]),
    kind: z.string(),
    before: z.string().optional(),
    after: z.string().optional(),
  })
  .strict()

const paperEditOutputSchema = z
  .object({
    docId: paperIdSchema,
    name: z.string(),
    kind: paperStoredKindSchema,
    revision: z.number().int(),
    editId: editIdSchema.nullable(),
    outcomes: z.array(paperEditOutcomeSchema),
    changes: z.array(paperChangeSchema).max(MAX_RECEIPT_CHANGES),
    moreChanges: z.number().int(),
  })
  .strict()

type DocInput = { docId: z.output<typeof paperIdSchema> }

const listChanged = (): QueryRef[] => [{ query: "paper.list" }]

const docChanged = (input: DocInput): QueryRef[] => [
  { query: "paper.document", input: { docId: input.docId } },
  { query: "paper.get", input: { docId: input.docId } },
  { query: "paper.outline", input: { docId: input.docId } },
  ...listChanged(),
]

const docRemoved = docChanged

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
      "Propose a change to a CV or Letter. Nothing is written until the person approves it in OpenCV; a pending result means the document is unchanged. On a saved Word document, read it first (paper_read for an agent, paper.outline for the Coach), pass its revision as basedOn and address lines by handle: setText (handle and the whole new text of that line, including first words on an empty line), insert (after a handle, or null for the start of the page, and the new line's text) and delete (handle). Send several operations in one edit to change several lines. Use only facts the person gave; do not invent the person's experience or qualifications. If the document changed after that read, the edit or its approval is refused and the document stays as it is; read it again and propose again. On a native block page, send writer version 4, protocol 1, supportedSchemaRevisions [1], capabilities structured-prose and underline, and copy nativeBasis from that exact paper.outline read. On a block page, address blocks by id from paper.outline: setText (a block's text as inline markdown), setFields (role, company, period, location, school, degree, detail, label, items, level, kind), setHeader (name, email, phone, city, linkedin), insert (new blocks after a block id or after the text @start), insertInto (list items inside an experience, education or list item), move (after a block id or the text @start), remove, and replaceText with a target id and exact before and after words.",
    input: z
      .object({
        docId: paperIdSchema,
        basedOn: z.union([z.number().int().min(0), z.string().uuid()]),
        writer: nativeWriterSchema.optional(),
        nativeBasis: nativeBasisSchema.optional(),
        edits: z.union([
          paperEditsSchema,
          paperPackageEditsSchema,
          wordConfirmedOpsSchema,
        ]),
      })
      .strict()
      .superRefine((input, ctx) => {
        const block = paperEditsSchema.safeParse(input.edits).success
        if (block === (typeof input.basedOn === "string"))
          ctx.addIssue({
            code: "custom",
            message: "This edit does not match the saved document.",
            path: ["edits"],
          })
      }),
    output: z.union([paperEditOutputSchema, paperPackageEditResultSchema]),
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
              query: "paper.get",
              input: { docId: parsePaperId(input.batch.doc) },
            },
            {
              query: "paper.outline",
              input: { docId: parsePaperId(input.batch.doc) },
            },
            ...listChanged(),
          ],
  }),
  "paper.nativeSync": commandEntry({
    description:
      "Exchange admitted native document changes with explicit writer and provenance.",
    input: nativeSyncInputSchema,
    output: nativeSyncOutputSchema,
    idempotency: "none",
    coach: "never",
    destructive: false,
    step: () => "Sync the document",
    invalidates: listChanged,
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
  "paper.delete": commandEntry({
    description: "Delete a document.",
    input: paperDeleteInputSchema,
    output: z
      .object({
        id: paperIdSchema,
        format: z.literal("word").optional(),
        name: z.string().optional(),
      })
      .strict(),
    coach: "confirm",
    destructive: true,
    step: () => "Delete this document",
    invalidates: (input) => [
      ...docRemoved(input),
      { query: "paper.isDeleted", input: { docId: input.docId } },
    ],
  }),
  "paper.restoreDeleted": commandEntry({
    description:
      "Bring back a deleted Word page with its content and Job link.",
    input: paperDeleteInputSchema,
    output: paperViewSchema,
    coach: "never",
    destructive: false,
    step: () => "Bring back the deleted page",
    invalidates: (input) => [
      ...docRemoved(input),
      { query: "paper.isDeleted", input: { docId: input.docId } },
    ],
  }),

  "paper.deleteFile": commandEntry({
    description: "Delete an uploaded file.",
    input: paperDeleteFileInputSchema,
    output: z.object({ fileId: fileIdSchema }).strict(),
    coach: "never",
    destructive: true,
    step: () => "Delete this file",
    invalidates: (input) => [
      { query: "paper.files" },
      { query: "file.get", input: { fileId: input.fileId } },
    ],
  }),
})

export type PaperContract = typeof paperContract
