import { randomBytes } from "node:crypto"

import {
  keywordGap,
  PAPER_RECEIPT_CHANGE_LIMIT,
  paperContract,
  paperPhotoFileId,
  paperPlainText,
  parseFileId,
  type PaperDocument,
  type PaperId,
} from "@workspace/domain"

import { bindCommands, tableQuery } from "../registry/bind.js"
import type { Registry } from "../registry/registry.js"
import { createId } from "../id.js"
import { editAsCoach, revertCoachEdit } from "./content-coach.js"
import { oldEditorUndoReasons, undoBlockedReasons } from "./undo-guard.js"
import { syncContent } from "./content-store.js"
import { readOutline } from "./outline.js"
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
  setPaperStatus,
  setPaperFavorite,
  setPaperTemplate,
  sharePaper,
  toPaper,
  unsharePaper,
} from "./store.js"

const newBlockId = () => `c${randomBytes(6).toString("base64url")}`

const noReversal = () => null
const noActivity = () => null

function attachPhotoReversal(
  input: { docId: PaperId },
  output: { previousPaper?: PaperDocument }
) {
  const photo =
    output.previousPaper?.kind === "cv"
      ? output.previousPaper.header.photo
      : undefined
  const fileId = paperPhotoFileId(photo)
  return {
    command: "paper.attachPhoto" as const,
    input: {
      docId: input.docId,
      fileId: fileId ? parseFileId(fileId) : null,
    },
    expect: {
      query: "paper.get" as const,
      input: { docId: input.docId },
      matches: { kind: "cv" as const },
      skipped: "This photo changed again, so Undo was skipped",
    },
  }
}

function bytesOf(encoded: string) {
  return new Uint8Array(Buffer.from(encoded, "base64"))
}

function encoded(bytes: Uint8Array) {
  return Buffer.from(bytes).toString("base64")
}

export function registerPaper(registry: Registry) {
  registry.addUndoGuard("paper.revertEdit", (userId, items) =>
    undoBlockedReasons(
      userId,
      items.map((item) =>
        paperContract["paper.revertEdit"].input.parse(item.input)
      )
    )
  )
  registry.addUndoGuard("paper.replace", oldEditorUndoReasons)
  registry.addUndoGuard("paper.restore", oldEditorUndoReasons)
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
    "paper.edit": {
      handler: async (input, actor) => {
        const result = await editAsCoach(
          actor.userId,
          input.docId,
          {
            basedOn: input.basedOn,
            edits: input.edits,
            editId: createId(),
            newId: newBlockId,
          },
          actor
        )
        const changes = result.changes.slice(0, PAPER_RECEIPT_CHANGE_LIMIT)
        return {
          ...result,
          changes,
          moreChanges: result.changes.length - changes.length,
        }
      },
      reversal: (input, output) =>
        output.editId
          ? {
              command: "paper.revertEdit",
              input: { docId: input.docId, editId: output.editId },
            }
          : null,
      activity: (input, output) =>
        output.editId
          ? {
              subjectKind: "paper",
              subjectId: input.docId,
              summary: `Edited ${output.name}`,
              detail: { docId: input.docId, name: output.name },
            }
          : null,
    },
    "paper.revertEdit": {
      handler: async (input, actor) => {
        const result = await revertCoachEdit(
          actor.userId,
          input.docId,
          input.editId
        )
        return { docId: input.docId, editId: input.editId, ...result }
      },
      reversal: noReversal,
      activity: noActivity,
    },
    "paper.sync": {
      handler: async (input, actor) => {
        const reply = await syncContent(actor.userId, input.docId, {
          epoch: input.epoch,
          update: bytesOf(input.update),
          stateVector: bytesOf(input.stateVector),
          basedOn: input.basedOn,
        })
        return {
          epoch: reply.epoch,
          revision: reply.revision,
          reset: reply.reset,
          stale: reply.stale,
          update: encoded(reply.update),
          stateVector: encoded(reply.stateVector),
        }
      },
      reversal: noReversal,
      activity: noActivity,
    },
    "paper.rename": {
      handler: (input, actor) => renamePaper(actor, input.docId, input.name),
      reversal: (input, output) => ({
        command: "paper.rename",
        input: { docId: input.docId, name: output.previousName },
      }),
      activity: noActivity,
    },
    "paper.setFavorite": {
      handler: (input, actor) =>
        setPaperFavorite(actor.userId, input.docId, input.isFavorite),
      reversal: noReversal,
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
      reversal: attachPhotoReversal,
      activity: (input, output) => ({
        subjectKind: "paper",
        subjectId: output.id,
        summary: input.fileId ? "Added a photo" : "Removed a photo",
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
    tableQuery("paper.outline", {
      description:
        "Read a bounded outline of a document with block ids, kinds, section titles, heading levels, marks and links, and the revision to pass as basedOn. Pass blockIds to mark selected blocks.",
      coach: true,
      step: () => "Read the document outline",
      read: (input, actor) =>
        readOutline(actor.userId, input.docId, input.blockIds),
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
        const letterText =
          doc.paper.kind === "letter" ? paperPlainText(doc.paper) : ""
        return keywordGap(letterText, job.posting?.requirements ?? "")
      },
    })
  )
}
