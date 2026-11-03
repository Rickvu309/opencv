import { z } from "zod"

import {
  commandContract,
  commandEntry,
  queryContract,
  queryEntry,
} from "./contract.js"
import { fileIdSchema, paperIdSchema } from "./ids.js"
import { cvDocumentV1Schema, letterDocumentV1Schema } from "./paper-codecs.js"
import { cvBlockDocumentSchema } from "./paper-blocks/document.js"
import { paperDocumentSchema } from "./paper-doc/document.js"
import {
  paperEditOutcomeSchema,
  paperEditsSchema,
} from "./paper-doc/edits-schema.js"
import {
  paperSyncInputSchema,
  paperSyncOutputSchema,
} from "./paper-doc/sync.js"
import {
  paperAttachPhotoInputSchema,
  paperCreateInputSchema,
  paperDeleteFileInputSchema,
  paperDeleteInputSchema,
  paperDismissCheckInputSchema,
  paperDocStatusSchema,
  paperDuplicateInputSchema,
  paperImportInputSchema,
  paperKeepTwoPagesInputSchema,
  paperKeywordGapInputSchema,
  paperRenameInputSchema,
  paperReplaceInputSchema,
  paperSetStatusCommandInputSchema,
  paperSetTemplateInputSchema,
  paperShareInputSchema,
  paperStoredKindSchema,
  paperTemplateIdSchema,
  paperUnshareInputSchema,
} from "./paper.js"
import type { QueryRef } from "./queries.js"

export const storedPaperDocumentSchema = z.union([
  cvBlockDocumentSchema,
  cvDocumentV1Schema,
  letterDocumentV1Schema,
])

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

const paperViewSchema = z
  .object({
    id: paperIdSchema,
    name: z.string(),
    kind: paperStoredKindSchema,
    templateId: paperTemplateIdSchema.nullable(),
    status: paperDocStatusSchema,
    document: storedPaperDocumentSchema,
    paper: paperDocumentSchema,
    contentVersion: z.number().int(),
    checks: z.array(paperCheckSchema),
    pageChoice: paperPageChoiceSchema,
    isFavorite: z.boolean(),
    sourceFileId: fileIdSchema.nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .strict()

export type PaperView = z.output<typeof paperViewSchema>

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
  "paper.list": queryEntry({
    input: z
      .object({
        query: z.string().optional(),
        kind: paperStoredKindSchema.optional(),
      })
      .strict(),
    output: z.array(paperViewSchema),
  }),
  "paper.get": queryEntry({
    input: z.object({ docId: paperIdSchema }).strict(),
    output: paperViewSchema,
  }),
  "paper.pageCount": queryEntry({
    input: z.object({ docId: paperIdSchema }).strict(),
    output: paperPagesSchema,
  }),
  "paper.shared": queryEntry({
    input: z.object({ token: z.string().min(8) }).strict(),
    output: paperViewSchema.omit({ isFavorite: true }).strict(),
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
      })
      .strict(),
    output: z
      .object({
        revision: z.number().int(),
        outline: z.string(),
        truncated: z.boolean(),
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

const previousDocument = storedPaperDocumentSchema
const previousPaper = paperDocumentSchema.optional()

export const paperContract = commandContract({
  "paper.create": commandEntry({
    description: "Create a CV or letter.",
    input: paperCreateInputSchema,
    output: paperViewSchema,
    coach: "auto",
    destructive: false,
    step: (input) => `Create a ${input.kind === "cv" ? "CV" : "letter"}`,
    invalidates: (input) => [
      ...listChanged(),
      ...(input.jobId ? jobsLinked() : []),
    ],
  }),
  "paper.replace": commandEntry({
    description:
      "Replace a document when the version matches. A letter keeps only the parts you send, so send every part to keep.",
    input: paperReplaceInputSchema,
    output: paperViewSchema
      .extend({ previousDocument, previousPaper })
      .strict(),
    idempotency: "none",
    coach: "never",
    destructive: false,
    step: () => "Update the document",
    invalidates: docChanged,
  }),
  "paper.restore": commandEntry({
    description:
      "Put back an earlier version of a document when the version matches.",
    input: paperReplaceInputSchema
      .extend({ paper: paperDocumentSchema })
      .strict(),
    output: paperViewSchema
      .extend({ previousDocument, previousPaper })
      .strict(),
    idempotency: "none",
    coach: "never",
    destructive: false,
    step: () => "Restore the document",
    invalidates: docChanged,
  }),
  "paper.edit": commandEntry({
    description:
      "Edit a CV or letter by block id. Read paper.outline first and pass its revision as basedOn. Ops: setText (a block's text as inline markdown), setFields (role, company, period, location, school, degree, detail, label, items, level, kind), setHeader (name, email, phone, city, linkedin), insert (new blocks after a block id or after the text @start), insertInto (list items inside an experience, education or list item), move (after a block id or the text @start) and remove. The person may be typing: setText merges with their typing, while move, remove, setFields and setHeader on something they changed are refused as stale. Read the outcomes and re-read paper.outline after a stale one.",
    input: z
      .object({
        docId: paperIdSchema,
        basedOn: z.number().int().min(0),
        edits: paperEditsSchema,
      })
      .strict(),
    output: paperEditOutputSchema,
    coach: "auto",
    destructive: false,
    step: () => "Edit the document",
    invalidates: (input) => [...docChanged(input), ...chatsChanged()],
  }),
  "paper.revertEdit": commandEntry({
    description: "Take back one Coach edit and keep later typing.",
    input: z.object({ docId: paperIdSchema, editId: editIdSchema }).strict(),
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
  "paper.sync": commandEntry({
    description:
      "Exchange document changes with the server. A push carries the revision it is based on and the caller's state vector. The server absorbs it only at that revision; otherwise it answers stale with everything the caller lacks and absorbs nothing. A pull sends no update.",
    input: paperSyncInputSchema,
    output: paperSyncOutputSchema,
    idempotency: "none",
    coach: "never",
    destructive: false,
    step: () => "Sync the document",
    invalidates: () => [],
  }),
  "paper.rename": commandEntry({
    description: "Rename a document.",
    input: paperRenameInputSchema,
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
    input: paperDuplicateInputSchema,
    output: paperViewSchema,
    coach: "auto",
    destructive: false,
    step: () => "Duplicate the document",
    invalidates: listChanged,
  }),
  "paper.delete": commandEntry({
    description: "Delete a document.",
    input: paperDeleteInputSchema,
    output: z.object({ id: paperIdSchema }).strict(),
    coach: "confirm",
    destructive: true,
    step: () => "Delete this document",
    invalidates: docRemoved,
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
    input: paperShareInputSchema,
    output: z.object({ docId: paperIdSchema, token: z.string() }).strict(),
    coach: "never",
    destructive: false,
    step: () => "Share the document",
    invalidates: () => [],
  }),
  "paper.unshare": commandEntry({
    description: "Stop sharing a document.",
    input: paperUnshareInputSchema,
    output: z.object({ docId: paperIdSchema }).strict(),
    coach: "never",
    destructive: false,
    step: () => "Stop sharing",
    invalidates: () => [{ query: "paper.shared" }],
  }),
  "paper.import": commandEntry({
    description: "Create a CV from an uploaded file.",
    input: paperImportInputSchema,
    output: paperViewSchema,
    coach: "auto",
    destructive: false,
    step: () => "Import a file",
    invalidates: listChanged,
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
    input: paperSetStatusCommandInputSchema,
    output: paperViewSchema,
    coach: "never",
    destructive: false,
    step: () => "Set status",
    invalidates: docChanged,
  }),
  "paper.attachPhoto": commandEntry({
    description: "Attach an uploaded photo to a CV.",
    input: paperAttachPhotoInputSchema,
    output: paperViewSchema
      .extend({ previousDocument, previousPaper })
      .strict(),
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
