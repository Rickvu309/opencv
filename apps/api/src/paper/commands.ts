import { randomBytes } from "node:crypto"

import {
  ERROR_CODES,
  keywordGap,
  PAPER_RECEIPT_CHANGE_LIMIT,
  paperContract,
  paperEditSchema,
  paperPhotoFileId,
  paperPlainText,
  parseFileId,
  type PaperDocument,
  type PaperId,
} from "@workspace/domain"

import { bindCommands, tableQuery } from "../registry/bind.js"
import { CommandError } from "../registry/errors.js"
import type { Registry } from "../registry/registry.js"
import { createId } from "../id.js"
import { editAsCoach, revertCoachEdit } from "./content-coach.js"
import { registerCanvasCommit } from "./package-canvas.js"
import { registerPaperStart } from "./package-start.js"
import { registerWordPackageEdit } from "./package-edit.js"
import { registerDuplicate, relinkJobs } from "./card-action-commands.js"
import { isWordPageDeleted } from "./package-card-actions.js"
import { missingDocument, ownedPackagePaper } from "./package-list.js"
import { oldEditorUndoReasons, undoBlockedReasons } from "./undo-guard.js"
import { syncContent } from "./content-store.js"
import { readOutline } from "./outline.js"
import { readPaperDocumentInfo } from "./document-info.js"
import { coachPaperList, coachWordPageWithText } from "./coach-word-pages.js"
import {
  attachPhoto,
  createPaper,
  deleteFile,
  deletePaper,
  dismissCheck,
  restoreDeletedPaper,
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
  const {
    "paper.edit": paperEdit,
    "paper.canvas": paperCanvas,
    "paper.start": paperStart,
    "paper.duplicate": paperDuplicate,
    ...paperCommands
  } = paperContract
  bindCommands(registry, paperCommands, {
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
    "paper.revertEdit": {
      handler: async (input, actor) => {
        const result = await revertCoachEdit(
          actor.userId,
          input.docId,
          input.editId,
          input.writer
        )
        return { docId: input.docId, editId: input.editId, ...result }
      },
      reversal: noReversal,
      activity: noActivity,
    },
    "paper.nativeSync": {
      handler: async (input, actor) => {
        const reply = await syncContent(actor.userId, input.docId, {
          writer: input.writer,
          provenance: input.provenance,
          epoch: input.epoch,
          update: bytesOf(input.update),
          stateVector: bytesOf(input.stateVector),
          basedOn: input.basedOn,
        })
        if (!reply.provenance)
          throw new CommandError(
            ERROR_CODES.VALIDATION_ERROR,
            "Native provenance required"
          )
        return {
          provenance: reply.provenance,
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
      handler: (input, actor) =>
        renamePaper(actor, input.docId, input.name, input.writer),
      reversal: (input, output) => ({
        command: "paper.rename",
        input: {
          docId: input.docId,
          name: output.previousName,
          ...(input.writer ? { writer: input.writer } : {}),
        },
      }),
      activity: noActivity,
    },
    "paper.setFavorite": {
      handler: (input, actor) =>
        setPaperFavorite(actor.userId, input.docId, input.isFavorite),
      reversal: noReversal,
      activity: noActivity,
    },
    "paper.delete": {
      handler: (input, actor) => deletePaper(actor, input.docId),
      reversal: (input, output) =>
        output.format === "word"
          ? {
              command: "paper.restoreDeleted",
              input: { docId: input.docId },
              expect: {
                query: "paper.isDeleted",
                input: { docId: input.docId },
                matches: { deleted: true },
                skipped: "This page is already back, so Undo was skipped",
              },
            }
          : null,
      activity: (_input, output) =>
        output.format === "word"
          ? {
              subjectKind: "paper",
              subjectId: output.id,
              summary: `Deleted ${output.name ?? "a Word page"}`,
            }
          : null,
    },
    "paper.restoreDeleted": {
      handler: async (input, actor) => {
        const restored = await restoreDeletedPaper(actor, input.docId)
        await relinkJobs(registry, actor, restored)
        return restored.page
      },
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
      handler: (input, actor) => sharePaper(actor, input.docId, input.writer),
      reversal: (input) => ({
        command: "paper.unshare",
        input: {
          docId: input.docId,
          ...(input.writer ? { writer: input.writer } : {}),
        },
      }),
      activity: noActivity,
    },
    "paper.unshare": {
      handler: (input, actor) => unsharePaper(actor, input.docId, input.writer),
      reversal: noReversal,
      activity: noActivity,
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
        setPaperStatus(actor, input.docId, input.status, input.writer),
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
  registerCanvasCommit(registry, paperCanvas)
  registerPaperStart(registry, paperStart)
  registerDuplicate(registry, paperDuplicate)
  registerWordPackageEdit(registry, paperEdit, async (input, actor) => {
    if (typeof input.basedOn !== "number")
      throw new CommandError(
        ERROR_CODES.CONFLICT,
        "This edit does not use a document revision."
      )
    const edits = paperEditSchema.array().min(1).parse(input.edits)
    const result = await editAsCoach(
      actor.userId,
      input.docId,
      {
        basedOn: input.basedOn,
        writer: input.writer,
        nativeBasis: input.nativeBasis,
        edits,
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
  })

  registry.addQuery(
    tableQuery("paper.document", {
      description: "Read the document identity and the editor it requires.",
      coach: false,
      step: () => "Read document identity",
      read: (input, actor) =>
        readPaperDocumentInfo(actor.userId, input.docId, input.writer),
    })
  )
  const paperList = tableQuery("paper.list", {
    description:
      "List documents. A Word page is listed without a document body: read its text with paper_outline.",
    coach: true,
    step: () => "List documents",
    read: (input, actor) =>
      listPapers(actor.userId, input.query, input.kind, input.writer),
  })
  registry.addQuery({
    ...paperList,
    read: async (input, actor) => {
      const views = await paperList.read(input, actor)
      return actor.type === "coach"
        ? coachPaperList(actor.userId, views)
        : views
    },
  })
  const paperGet = tableQuery("paper.get", {
    description:
      "Read one document. For a Word page this returns its saved text outline as content, not a document body; use paper_outline for line handles and the rest of a long page.",
    coach: true,
    step: (input) => `Read document ${input.docId}`,
    read: async (input, actor) =>
      toPaper(
        await ownedPaper(actor.userId, input.docId, input.writer),
        undefined,
        input.writer
      ),
  })
  registry.addQuery({
    ...paperGet,
    read: async (input, actor) => {
      try {
        return await paperGet.read(input, actor)
      } catch (error) {
        if (actor.type !== "coach" || !missingDocument(error)) throw error
        const page = await ownedPackagePaper(actor.userId, input.docId)
        if (!page) throw error
        return coachWordPageWithText(actor.userId, page)
      }
    },
  })
  registry.addQuery(
    tableQuery("paper.outline", {
      description:
        "Read a bounded outline of a document with block ids, kinds, section titles, heading levels, marks and links, and the revision to pass as basedOn. Pass blockIds to mark selected blocks. For native version 4 Letters, declare writer documentVersion 4, writerProtocol 1, supportedSchemaRevisions [1], capabilities structured-prose and underline; copy the returned nativeBasis unchanged into paper.edit. If truncated, pass nextCursor as cursor to read the next Word part at the same saved revision.",
      coach: true,
      step: () => "Read the document outline",
      read: (input, actor) =>
        readOutline(
          actor.userId,
          input.docId,
          input.blockIds,
          input.cursor,
          input.writer
        ),
    })
  )
  registry.addQuery(
    tableQuery("paper.isDeleted", {
      description:
        "Say whether a Word page is deleted and can be brought back.",
      coach: false,
      step: () => "Check a deleted page",
      read: async (input, actor) => ({
        docId: input.docId,
        deleted: await isWordPageDeleted(actor.userId, input.docId),
      }),
    })
  )
  registry.addQuery(
    tableQuery("paper.pageCount", {
      description: "Count pages in a document.",
      coach: true,
      step: () => "Count pages",
      read: (input, actor) => pageCount(actor, input.docId, input.writer),
    })
  )
  registry.addQuery(
    tableQuery("paper.shared", {
      description: "Read a shared document.",
      coach: false,
      step: () => "Read a shared document",
      read: (input) => readShared(input.token, input.writer),
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
