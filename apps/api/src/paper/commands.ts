import {
  cvCodecToBlocks,
  isCvBlockDocument,
  isCvDocument,
  keywordGap,
  paperContract,
} from "@workspace/domain"

import { bindCommands, tableQuery } from "../registry/bind.js"
import type { Registry } from "../registry/registry.js"
import {
  attachPhoto,
  createPaper,
  deleteFile,
  deletePaper,
  dismissCheck,
  duplicatePaper,
  importPaper,
  keepTwoPages,
  listFiles,
  listPapers,
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

const noReversal = () => null
const noActivity = () => null

export function registerPaper(registry: Registry) {
  bindCommands(registry, paperContract, {
    "paper.create": {
      handler: async (input, actor) => {
        const created = await createPaper(actor, input)
        if (input.jobId) {
          await registry.execute({
            name: "job.linkPaper",
            input: { jobId: input.jobId, docId: created.id, kind: input.kind },
            actor,
          })
        }
        return created
      },
      reversal: (_input, output) => ({
        command: "paper.delete",
        input: { docId: output.id },
      }),
      activity: (_input, output) => ({
        subjectKind: "paper",
        subjectId: output.id,
        summary: `Created ${output.name}`,
      }),
    },
    "paper.replace": {
      handler: async (input, actor) => {
        let document = input.document
        // The Coach still writes the version 1 shape. A block row stays version 2.
        if (actor.type === "coach" && isCvDocument(document)) {
          const current = await ownedPaper(actor.userId, input.docId)
          if (current.kind === "cv" && isCvBlockDocument(current.document)) {
            document = cvCodecToBlocks(document)
          }
        }
        return replacePaper(actor, { ...input, document })
      },
      reversal: (input, output) => ({
        command: "paper.replace",
        input: {
          docId: input.docId,
          contentVersion: output.contentVersion,
          document: output.previousDocument,
        },
      }),
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
    "paper.rename": {
      handler: (input, actor) => renamePaper(actor, input.docId, input.name),
      reversal: (input, output) => ({
        command: "paper.rename",
        input: { docId: input.docId, name: output.previousName },
      }),
      activity: noActivity,
    },
    "paper.duplicate": {
      handler: (input, actor) => duplicatePaper(actor, input.docId),
      reversal: (_input, output) => ({
        command: "paper.delete",
        input: { docId: output.id },
      }),
      activity: (_input, output) => ({
        subjectKind: "paper",
        subjectId: output.id,
        summary: `Duplicated ${output.name}`,
      }),
    },
    "paper.delete": {
      handler: (input, actor) => deletePaper(actor, input.docId),
      reversal: noReversal,
      activity: noActivity,
    },
    "paper.setTemplate": {
      handler: (input, actor) =>
        setPaperTemplate(actor, input.docId, input.templateId),
      reversal: (input, output) => ({
        command: "paper.setTemplate",
        input: {
          docId: input.docId,
          templateId: output.previousTemplateId ?? "simple",
        },
      }),
      activity: noActivity,
    },
    "paper.share": {
      handler: (input, actor) => sharePaper(actor, input.docId),
      reversal: (input) => ({
        command: "paper.unshare",
        input: { docId: input.docId },
      }),
      activity: noActivity,
    },
    "paper.unshare": {
      handler: (input, actor) => unsharePaper(actor, input.docId),
      reversal: noReversal,
      activity: noActivity,
    },
    "paper.import": {
      handler: (input, actor) => importPaper(actor, input.fileId),
      reversal: (_input, output) => ({
        command: "paper.delete",
        input: { docId: output.id },
      }),
      activity: (_input, output) => ({
        subjectKind: "paper",
        subjectId: output.id,
        summary: `Imported ${output.name}`,
      }),
    },
    "paper.dismissCheck": {
      handler: (input, actor) =>
        dismissCheck(actor, input.docId, input.checkId),
      reversal: noReversal,
      activity: noActivity,
    },
    "paper.keepTwoPages": {
      handler: (input, actor) => keepTwoPages(actor, input.docId),
      reversal: noReversal,
      activity: noActivity,
    },
    "paper.setStatus": {
      handler: (input, actor) =>
        setPaperStatus(actor, input.docId, input.status),
      reversal: noReversal,
      activity: noActivity,
    },
    "paper.attachPhoto": {
      handler: (input, actor) => attachPhoto(actor, input.docId, input.fileId),
      reversal: (input, output) => ({
        command: "paper.replace",
        input: {
          docId: input.docId,
          contentVersion: output.contentVersion,
          document: output.previousDocument,
        },
      }),
      activity: (_input, output) => ({
        subjectKind: "paper",
        subjectId: output.id,
        summary: "Added a photo",
      }),
    },
    "paper.deleteFile": {
      handler: (input, actor) => deleteFile(actor, input.fileId),
      reversal: noReversal,
      activity: noActivity,
    },
  })

  registry.addQuery(
    tableQuery("paper.list", {
      description: "List documents.",
      coach: true,
      step: () => "List documents",
      read: (input, actor) => listPapers(actor.userId, input.query, input.kind),
    })
  )
  registry.addQuery(
    tableQuery("paper.get", {
      description: "Read one document.",
      coach: true,
      step: (input) => `Read document ${input.docId}`,
      read: async (input, actor) =>
        toPaper(await ownedPaper(actor.userId, input.docId)),
    })
  )
  registry.addQuery(
    tableQuery("paper.pageCount", {
      description: "Count pages in a document.",
      coach: true,
      step: () => "Count pages",
      read: (input, actor) => pageCount(actor, input.docId),
    })
  )
  registry.addQuery(
    tableQuery("paper.pdf", {
      description: "Render a document as PDF bytes.",
      coach: false,
      step: () => "Download PDF",
      read: async (input, actor) => {
        const doc = toPaper(await ownedPaper(actor.userId, input.docId))
        return { docId: doc.id, name: doc.name }
      },
    })
  )
  registry.addQuery(
    tableQuery("paper.shared", {
      description: "Read a shared document.",
      coach: false,
      step: () => "Read a shared document",
      read: (input) => readShared(input.token),
    })
  )
  registry.addQuery(
    tableQuery("file.get", {
      description: "Read a file's name and size. The bytes stay in the store.",
      coach: true,
      step: () => "Read the file",
      read: (input, actor) => readFileMeta(actor.userId, input.fileId),
    })
  )
  registry.addQuery(
    tableQuery("paper.files", {
      description: "List uploaded files. Bytes stay in the store.",
      coach: false,
      step: () => "List files",
      read: (_input, actor) => listFiles(actor.userId),
    })
  )
  registry.addQuery(
    tableQuery("paper.keywordGap", {
      description: "Find one requirement the letter does not mention.",
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
