import { z } from "zod"

import {
  commandContract,
  commandEntry,
  queryContract,
  queryEntry,
} from "./contract.js"
import {
  fileIdSchema,
  jobIdSchema,
  paperIdSchema,
  parsePaperId,
} from "./ids.js"
import {
  legacyPaperDocumentSchema,
  paperDocumentSchema,
} from "./paper-doc/document.js"
import {
  nativeBasisSchema,
  nativeWriterSchema,
  nativeSyncInputSchema,
  nativeSyncOutputSchema,
  nativeProvenanceSchema,
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
  paperSyncInputSchema,
  paperSyncOutputSchema,
} from "./paper-doc/sync.js"
import {
  paperAttachPhotoInputSchema,
  paperDeleteFileInputSchema,
  paperDeleteInputSchema,
  paperDismissCheckInputSchema,
  paperDocNameSchema,
  paperDocStatusSchema,
  paperDuplicateInputSchema,
  paperKeepTwoPagesInputSchema,
  paperKeywordGapInputSchema,
  paperRenameInputSchema,
  paperSetStatusCommandInputSchema,
  paperSetTemplateInputSchema,
  paperShareInputSchema,
  paperStoredKindSchema,
  paperTemplateIdSchema,
  paperUnshareInputSchema,
} from "./paper.js"
import type { QueryRef } from "./queries.js"
import { richPaperCommands, richPaperQueries } from "./paper-rich-contract.js"

export const paperCheckSchema = z
  .object({
    id: z.string(),
    kind: z.string(),
    message: z.string(),
    blockId: z.string().optional(),
    resolved: z.boolean().optional(),
  })
  .strict()

const paperPageChoiceSchema = z.enum(["unset", "keep"])

export const paperViewSchema = z
  .object({
    id: paperIdSchema,
    name: z.string(),
    kind: paperStoredKindSchema,
    templateId: paperTemplateIdSchema.nullable(),
    status: paperDocStatusSchema,
    paper: paperDocumentSchema,
    nativeBasis: nativeBasisSchema.optional(),
    contentVersion: z.number().int(),
    checks: z.array(paperCheckSchema),
    pageChoice: paperPageChoiceSchema,
    isFavorite: z.boolean(),
    sourceFileId: fileIdSchema.nullable(),
    format: z.literal("word").optional(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .strict()

export type PaperView = z.output<typeof paperViewSchema>

const paperIdentitySchema = paperViewSchema.pick({
  id: true,
  name: true,
  kind: true,
})

export const paperDocumentInfoSchema = z.discriminatedUnion("format", [
  paperIdentitySchema.extend({ format: z.enum(["word", "prose"]) }).strict(),
  paperIdentitySchema
    .extend({ format: z.literal("rich"), provenance: nativeProvenanceSchema })
    .strict(),
])

export const paperSharedViewSchema = paperViewSchema
  .pick({ id: true, name: true, kind: true, templateId: true, paper: true })
  .extend({
    paper: paperDocumentSchema.refine((paper) => paper.clashes.length === 0),
  })
  .strict()

export type PaperSharedView = z.output<typeof paperSharedViewSchema>

export const PAPER_COACH_WORD_PAGE_NOTE =
  "This is a Word page. It has no document body in this result. Read its text with paper_outline before describing, reviewing or changing it."

export const paperCoachWordPageSchema = paperViewSchema
  .omit({ paper: true })
  .extend({
    format: z.literal("word"),
    content: z.string().nullable(),
    note: z.literal(PAPER_COACH_WORD_PAGE_NOTE),
  })
  .strict()

export type PaperCoachWordPage = z.output<typeof paperCoachWordPageSchema>

const paperFileSchema = z
  .object({
    id: fileIdSchema,
    name: z.string(),
    mediaType: z.string(),
    byteSize: z.number().int(),
    createdAt: z.string().datetime(),
  })
  .strict()

export type PaperFile = z.output<typeof paperFileSchema>

const paperPagesSchema = z
  .object({
    docId: paperIdSchema,
    pages: z.number().int().positive(),
    pageChoice: paperPageChoiceSchema,
  })
  .strict()

export type PaperPages = z.output<typeof paperPagesSchema>

const empty = z.object({}).strict()

const blockIdSchema = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/)
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

export const PAPER_RECEIPT_CHANGE_LIMIT = MAX_RECEIPT_CHANGES

export const paperQueries = queryContract({
  ...richPaperQueries,
  "paper.document": queryEntry({
    input: z
      .object({ docId: paperIdSchema, writer: nativeWriterSchema.optional() })
      .strict(),
    output: paperDocumentInfoSchema,
  }),
  "paper.list": queryEntry({
    input: z
      .object({
        query: z.string().optional(),
        writer: nativeWriterSchema.optional(),
        kind: paperStoredKindSchema.optional(),
      })
      .strict(),
    output: z.array(paperViewSchema),
  }),
  "paper.get": queryEntry({
    input: z
      .object({ docId: paperIdSchema, writer: nativeWriterSchema.optional() })
      .strict(),
    output: paperViewSchema,
  }),
  "paper.isDeleted": queryEntry({
    input: z.object({ docId: paperIdSchema }).strict(),
    output: z.object({ docId: paperIdSchema, deleted: z.boolean() }).strict(),
  }),
  "paper.pageCount": queryEntry({
    input: z
      .object({ docId: paperIdSchema, writer: nativeWriterSchema.optional() })
      .strict(),
    output: paperPagesSchema,
  }),
  "paper.shared": queryEntry({
    input: z
      .object({
        token: z.string().min(8),
        writer: nativeWriterSchema.optional(),
      })
      .strict(),
    output: paperSharedViewSchema,
  }),
  "file.get": queryEntry({
    input: z.object({ fileId: fileIdSchema }).strict(),
    output: paperFileSchema.omit({ createdAt: true }),
  }),
  "paper.files": queryEntry({
    input: empty,
    output: z.array(paperFileSchema),
  }),
  "paper.outline": queryEntry({
    input: z
      .object({
        docId: paperIdSchema,
        blockIds: z.array(blockIdSchema).max(50).optional(),
        writer: nativeWriterSchema.optional(),
        cursor: z.string().min(1).max(2048).optional(),
      })
      .strict(),
    output: z
      .object({
        revision: z.union([z.number().int(), z.string().uuid()]),
        nativeBasis: nativeBasisSchema.optional(),
        outline: z.string(),
        truncated: z.boolean(),
        nextCursor: z.string().max(2048).nullable().optional(),
        omittedParagraphs: z.number().int().nonnegative().optional(),
        omittedChars: z.number().int().nonnegative().optional(),
      })
      .strict(),
  }),
  "paper.keywordGap": queryEntry({
    input: paperKeywordGapInputSchema,
    output: z
      .object({ keyword: z.string(), sentence: z.string() })
      .strict()
      .nullable(),
  }),
})

type DocInput = { docId: z.output<typeof paperIdSchema> }

const listChanged = (): QueryRef[] => [{ query: "paper.list" }]

const docChanged = (input: DocInput): QueryRef[] => [
  { query: "paper.readRich", input: { docId: input.docId } },
  { query: "paper.document", input: { docId: input.docId } },
  { query: "paper.get", input: { docId: input.docId } },
  { query: "paper.pageCount", input: { docId: input.docId } },
  { query: "paper.outline", input: { docId: input.docId } },
  { query: "paper.keywordGap", input: { docId: input.docId } },
  ...listChanged(),
]

const chatsChanged = (): QueryRef[] => [{ query: "chat.get" }]

const jobsLinked = (): QueryRef[] => [
  { query: "job.list" },
  { query: "job.get" },
]

const docRemoved = (input: DocInput): QueryRef[] => [
  ...docChanged(input),
  ...jobsLinked(),
]

const previousPaper = paperDocumentSchema.optional()

const paperCreateInputSchema = z
  .object({
    kind: paperStoredKindSchema,
    document: legacyPaperDocumentSchema.optional(),
    templateId: paperTemplateIdSchema.optional(),
    name: paperDocNameSchema.optional(),
    jobId: jobIdSchema.optional(),
  })
  .strict()
  .superRefine((input, context) => {
    if (input.document && input.document.kind !== input.kind) {
      context.addIssue({
        code: "custom",
        message: "The document kind does not match.",
        path: ["document"],
      })
    }
  })

export const paperContract = commandContract({
  ...richPaperCommands((input) => [...docChanged(input), ...chatsChanged()]),
  "paper.create": commandEntry({
    description: "Create a CV or letter.",
    input: paperCreateInputSchema,
    output: paperViewSchema,
    coach: "never",
    destructive: false,
    step: (input) => `Create a ${input.kind === "cv" ? "CV" : "letter"}`,
    invalidates: (input) => [
      ...listChanged(),
      ...(input.jobId ? jobsLinked() : []),
    ],
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
    invalidates: (input) => [
      ...listChanged(),
      ...(input.jobId ? jobsLinked() : []),
    ],
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
    invalidates: (input) => [...docChanged(input), ...chatsChanged()],
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
        ? [...listChanged(), ...(input.jobId ? jobsLinked() : [])]
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
  "paper.revertEdit": commandEntry({
    description: "Take back one Coach edit and keep later typing.",
    input: z
      .object({
        docId: paperIdSchema,
        editId: editIdSchema,
        writer: nativeWriterSchema.optional(),
      })
      .strict(),
    output: z
      .object({
        docId: paperIdSchema,
        revision: z.number().int(),
        editId: editIdSchema,
        reverted: z.boolean(),
      })
      .strict(),
    coach: "never",
    destructive: false,
    step: () => "Undo a Coach edit",
    invalidates: (input) => [...docChanged(input), ...chatsChanged()],
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
    invalidates: () => [],
  }),
  "paper.sync": commandEntry({
    description:
      "Exchange document changes with the server. A push carries the revision it is based on and the caller's state vector. The server absorbs it only at that revision; otherwise it answers stale with everything the caller lacks and absorbs nothing. A pull sends no update.",
    input: paperSyncInputSchema,
    output: paperSyncOutputSchema,
    idempotency: "none",
    coach: "never",
    destructive: false,
    step: () => "Sync the document",
    invalidates: (input) => [
      { query: "paper.readRich", input: { docId: input.docId } },
    ],
  }),
  "paper.rename": commandEntry({
    description: "Rename a document.",
    input: paperRenameInputSchema.extend({
      writer: nativeWriterSchema.optional(),
    }),
    output: paperViewSchema.extend({ previousName: z.string() }).strict(),
    coach: "auto",
    destructive: false,
    step: () => "Rename the document",
    invalidates: docChanged,
  }),
  "paper.setFavorite": commandEntry({
    description: "Set whether a document is a favorite.",
    input: z.object({ docId: paperIdSchema, isFavorite: z.boolean() }).strict(),
    output: z
      .object({ docId: paperIdSchema, isFavorite: z.boolean() })
      .strict(),
    coach: "never",
    destructive: false,
    step: () => "Set favorite",
    invalidates: (input) => [
      { query: "paper.get", input: { docId: input.docId } },
      { query: "paper.list" },
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
  "paper.setTemplate": commandEntry({
    description: "Change the document template.",
    input: paperSetTemplateInputSchema,
    output: paperViewSchema
      .extend({ previousTemplateId: paperTemplateIdSchema.nullable() })
      .strict(),
    coach: "auto",
    destructive: false,
    step: () => "Change the template",
    invalidates: docChanged,
  }),
  "paper.share": commandEntry({
    description: "Share a document.",
    input: paperShareInputSchema
      .extend({ writer: nativeWriterSchema.optional() })
      .strict(),
    output: z.object({ docId: paperIdSchema, token: z.string() }).strict(),
    coach: "never",
    destructive: false,
    step: () => "Share the document",
    invalidates: () => [],
  }),
  "paper.unshare": commandEntry({
    description: "Stop sharing a document.",
    input: paperUnshareInputSchema
      .extend({ writer: nativeWriterSchema.optional() })
      .strict(),
    output: z.object({ docId: paperIdSchema }).strict(),
    coach: "never",
    destructive: false,
    step: () => "Stop sharing",
    invalidates: () => [{ query: "paper.shared" }],
  }),

  "paper.dismissCheck": commandEntry({
    description: "Dismiss an import check.",
    input: paperDismissCheckInputSchema,
    output: paperViewSchema,
    coach: "never",
    destructive: false,
    step: () => "Dismiss a check",
    invalidates: docChanged,
  }),
  "paper.keepTwoPages": commandEntry({
    description: "Keep a two-page document.",
    input: paperKeepTwoPagesInputSchema,
    output: paperViewSchema,
    coach: "never",
    destructive: false,
    step: () => "Keep two pages",
    invalidates: docChanged,
  }),
  "paper.setStatus": commandEntry({
    description: "Set a document status.",
    input: paperSetStatusCommandInputSchema.extend({
      writer: nativeWriterSchema.optional(),
    }),
    output: paperViewSchema,
    coach: "never",
    destructive: false,
    step: () => "Set status",
    invalidates: docChanged,
  }),
  "paper.attachPhoto": commandEntry({
    description: "Attach an uploaded photo to a CV.",
    input: paperAttachPhotoInputSchema,
    output: paperViewSchema.extend({ previousPaper }).strict(),
    coach: "auto",
    destructive: false,
    step: () => "Add a photo",
    invalidates: docChanged,
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
