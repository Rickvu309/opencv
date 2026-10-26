import {
  defineQuery,
  fileIdSchema,
  paperIdSchema,
  paperCreateInputSchema,
  paperDeleteInputSchema,
  paperDismissCheckInputSchema,
  paperDuplicateInputSchema,
  paperImportInputSchema,
  paperKeepTwoPagesInputSchema,
  paperRenameInputSchema,
  paperReplaceInputSchema,
  paperSetStatusCommandInputSchema,
  paperSetTemplateInputSchema,
  paperShareInputSchema,
  paperUnshareInputSchema,
  paperDeleteFileInputSchema,
  paperKeywordGapInputSchema,
  keywordGap,
  type Actor,
  type PaperCreateInput,
  type PaperDuplicateInput,
  type PaperImportInput,
  type PaperRenameDocInput,
  type PaperReplaceInput,
  type PaperSetTemplateInput,
} from "@workspace/domain"
import { z } from "zod"

import type { Registry } from "../registry/registry.js"
import {
  createPaper,
  deletePaper,
  dismissCheck,
  duplicatePaper,
  importPaper,
  keepTwoPages,
  listFiles,
  listPapers,
  deleteFile,
  ownedPaper,
  pageCount,
  readFileMeta,
  readShared,
  renamePaper,
  replacePaper,
  setPaperStatus,
  setPaperTemplate,
  sharePaper,
  toPaper,
  unsharePaper,
} from "./store.js"

export function registerPaper(registry: Registry) {
  registry.addCommand(
    {
      name: "paper.create",
      description: "Create a CV or letter.",
      input: paperCreateInputSchema,
      coach: "auto",
      destructive: false,
      reversal: (_input, output) => ({
        command: "paper.delete",
        input: { docId: output.id },
      }),
      step: (input) => `Create a ${input.kind === "cv" ? "CV" : "letter"}`,
      activity: (_input, output) => ({
        subjectKind: "paper",
        subjectId: output.id,
        summary: `Created ${output.name}`,
      }),
    },
    async (input: PaperCreateInput, actor: Actor) => {
      const created = await createPaper(actor, input)
      if (input.jobId) {
        await registry.execute({
          name: "job.linkPaper",
          input: { jobId: input.jobId, docId: created.id, kind: input.kind },
          actor,
        })
      }
      return created
    }
  )

  registry.addCommand(
    {
      name: "paper.replace",
      description: "Replace a document when the version matches.",
      input: paperReplaceInputSchema,
      coach: "auto",
      destructive: false,
      reversal: (input, output) => ({
        command: "paper.replace",
        input: {
          docId: input.docId,
          contentVersion: output.contentVersion,
          document: output.previousDocument,
        },
      }),
      step: () => "Update the document",
      activity: (input, output, actor) =>
        actor.type === "coach"
          ? {
              subjectKind: "paper",
              subjectId: input.docId,
              summary: `Updated ${output.name}`,
              detail: { docId: input.docId, name: output.name },
            }
          : null,
    },
    (input: PaperReplaceInput, actor: Actor) => replacePaper(actor, input)
  )

  registry.addCommand(
    {
      name: "paper.rename",
      description: "Rename a document.",
      input: paperRenameInputSchema,
      coach: "auto",
      destructive: false,
      reversal: (input, output) => ({
        command: "paper.rename",
        input: { docId: input.docId, name: output.previousName },
      }),
      step: () => "Rename the document",
      activity: () => null,
    },
    (input: PaperRenameDocInput, actor: Actor) =>
      renamePaper(actor, input.docId, input.name)
  )

  registry.addCommand(
    {
      name: "paper.duplicate",
      description: "Duplicate a document.",
      input: paperDuplicateInputSchema,
      coach: "auto",
      destructive: false,
      reversal: (_input, output) => ({
        command: "paper.delete",
        input: { docId: output.id },
      }),
      step: () => "Duplicate the document",
      activity: (_input, output) => ({
        subjectKind: "paper",
        subjectId: output.id,
        summary: `Duplicated ${output.name}`,
      }),
    },
    (input: PaperDuplicateInput, actor: Actor) =>
      duplicatePaper(actor, input.docId)
  )

  registry.addCommand(
    {
      name: "paper.delete",
      description: "Delete a document.",
      input: paperDeleteInputSchema,
      coach: "confirm",
      destructive: true,
      reversal: () => null,
      step: () => "Delete this document",
      activity: () => null,
    },
    (input, actor) => deletePaper(actor, input.docId)
  )

  registry.addCommand(
    {
      name: "paper.setTemplate",
      description: "Change the document template.",
      input: paperSetTemplateInputSchema,
      coach: "auto",
      destructive: false,
      reversal: (input, output) => ({
        command: "paper.setTemplate",
        input: {
          docId: input.docId,
          templateId: output.previousTemplateId ?? "simple",
        },
      }),
      step: () => "Change the template",
      activity: () => null,
    },
    (input: PaperSetTemplateInput, actor: Actor) =>
      setPaperTemplate(actor, input.docId, input.templateId)
  )

  registry.addCommand(
    {
      name: "paper.share",
      description: "Share a document.",
      input: paperShareInputSchema,
      coach: "never",
      destructive: false,
      reversal: (input) => ({
        command: "paper.unshare",
        input: { docId: input.docId },
      }),
      step: () => "Share the document",
      activity: () => null,
    },
    (input, actor) => sharePaper(actor, input.docId)
  )

  registry.addCommand(
    {
      name: "paper.unshare",
      description: "Stop sharing a document.",
      input: paperUnshareInputSchema,
      coach: "never",
      destructive: false,
      reversal: () => null,
      step: () => "Stop sharing",
      activity: () => null,
    },
    (input, actor) => unsharePaper(actor, input.docId)
  )

  registry.addCommand(
    {
      name: "paper.import",
      description: "Create a CV from an uploaded file.",
      input: paperImportInputSchema,
      coach: "auto",
      destructive: false,
      reversal: (_input, output) => ({
        command: "paper.delete",
        input: { docId: output.id },
      }),
      step: () => "Import a file",
      activity: (_input, output) => ({
        subjectKind: "paper",
        subjectId: output.id,
        summary: `Imported ${output.name}`,
      }),
    },
    (input: PaperImportInput, actor: Actor) => importPaper(actor, input.fileId)
  )

  registry.addCommand(
    {
      name: "paper.dismissCheck",
      description: "Dismiss an import check.",
      input: paperDismissCheckInputSchema,
      coach: "never",
      destructive: false,
      reversal: () => null,
      step: () => "Dismiss a check",
      activity: () => null,
    },
    (input, actor) => dismissCheck(actor, input.docId, input.checkId)
  )

  registry.addCommand(
    {
      name: "paper.keepTwoPages",
      description: "Keep a two-page document.",
      input: paperKeepTwoPagesInputSchema,
      coach: "never",
      destructive: false,
      reversal: () => null,
      step: () => "Keep two pages",
      activity: () => null,
    },
    (input, actor) => keepTwoPages(actor, input.docId)
  )

  registry.addCommand(
    {
      name: "paper.setStatus",
      description: "Set a document status.",
      input: paperSetStatusCommandInputSchema,
      coach: "never",
      destructive: false,
      reversal: () => null,
      step: () => "Set status",
      activity: () => null,
    },
    (input, actor) => setPaperStatus(actor, input.docId, input.status)
  )

  registry.addCommand(
    {
      name: "paper.deleteFile",
      description: "Delete an uploaded file.",
      input: paperDeleteFileInputSchema,
      coach: "never",
      destructive: true,
      reversal: () => null,
      step: () => "Delete this file",
      activity: () => null,
    },
    (input, actor) => deleteFile(actor, input.fileId)
  )

  registry.addQuery(
    defineQuery({
      name: "paper.list",
      description: "List documents.",
      input: z
        .object({
          query: z.string().optional(),
          kind: z.enum(["cv", "letter"]).optional(),
        })
        .strict(),
      coach: true,
      step: () => "List documents",
      read: (input, actor) => listPapers(actor.userId, input.query, input.kind),
    })
  )
  registry.addQuery(
    defineQuery({
      name: "paper.get",
      description: "Read one document.",
      input: z.object({ docId: paperIdSchema }).strict(),
      coach: true,
      step: (input) => `Read document ${input.docId}`,
      read: async (input, actor) =>
        toPaper(await ownedPaper(actor.userId, input.docId)),
    })
  )
  registry.addQuery(
    defineQuery({
      name: "paper.pageCount",
      description: "Count pages in a document.",
      input: z.object({ docId: paperIdSchema }).strict(),
      coach: true,
      step: () => "Count pages",
      read: (input, actor) => pageCount(actor, input.docId),
    })
  )
  registry.addQuery(
    defineQuery({
      name: "paper.pdf",
      description: "Render a document as PDF bytes.",
      input: z.object({ docId: paperIdSchema }).strict(),
      coach: false,
      step: () => "Download PDF",
      read: async (input, actor) => {
        const doc = toPaper(await ownedPaper(actor.userId, input.docId))
        return { docId: doc.id, name: doc.name }
      },
    })
  )
  registry.addQuery(
    defineQuery({
      name: "paper.shared",
      description: "Read a shared document.",
      input: z.object({ token: z.string().min(8) }).strict(),
      coach: false,
      step: () => "Read a shared document",
      read: (input) => readShared(input.token),
    })
  )
  registry.addQuery(
    defineQuery({
      name: "file.get",
      description: "Read a file's name and size. The bytes stay in the store.",
      input: z.object({ fileId: fileIdSchema }).strict(),
      coach: true,
      step: () => "Read the file",
      read: (input, actor) => readFileMeta(actor.userId, input.fileId),
    })
  )
  registry.addQuery(
    defineQuery({
      name: "paper.files",
      description: "List uploaded files. Bytes stay in the store.",
      input: z.object({}).strict(),
      coach: true,
      step: () => "List files",
      read: (_input, actor) => listFiles(actor.userId),
    })
  )
  registry.addQuery(
    defineQuery({
      name: "paper.keywordGap",
      description: "Find one requirement the letter does not mention.",
      input: paperKeywordGapInputSchema,
      coach: true,
      step: () => "Find a missing keyword",
      read: async (input, actor) => {
        const doc = toPaper(await ownedPaper(actor.userId, input.docId))
        const job = (await registry.read(
          "job.get",
          { jobId: input.jobId },
          actor
        )) as { posting?: { requirements?: string } | null }
        const document = doc.document
        const letterText =
          document &&
          typeof document === "object" &&
          "markdown" in document &&
          typeof document.markdown === "string"
            ? document.markdown
            : ""
        return keywordGap(letterText, job.posting?.requirements ?? "")
      },
    })
  )
}
