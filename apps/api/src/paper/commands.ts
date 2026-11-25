import {
  catalog,
  ERROR_CODES,
  emptyRichPaper,
  paperContract,
  RICH_NATIVE_WRITER,
} from "@workspace/domain"

import { bindCommands, tableQuery } from "../registry/bind.js"
import { CommandError } from "../platform/errors.js"
import type { Registry } from "../registry/registry.js"
import { registerCanvasCommit } from "./package-canvas.js"
import { registerPaperStart } from "./package-start.js"
import { registerWordPackageEdit } from "./package-edit.js"
import { registerDuplicate } from "./card-action-commands.js"
import { missingDocument, ownedPackagePaper } from "./package-list.js"
import { oldEditorUndoReasons } from "./undo-guard.js"
import { syncContent } from "./content-store.js"
import { readOutline } from "./outline.js"
import { readPaperDocumentInfo } from "./document-info.js"
import { coachPaperList, coachWordPageWithText } from "./coach-word-pages.js"
import {
  createPaper,
  deleteFile,
  deletePaper,
  listFiles,
  listPapers,
  ownedPaper,
  readFileMeta,
} from "./store.js"

const noReversal = () => null
const noActivity = () => null

function bytesOf(encoded: string) {
  return new Uint8Array(Buffer.from(encoded, "base64"))
}

function encoded(bytes: Uint8Array) {
  return Buffer.from(bytes).toString("base64")
}

export function registerPaper(registry: Registry) {
  registry.addUndoGuard("paper.revertEdit", oldEditorUndoReasons)
  registry.addUndoGuard("paper.attachPhoto", oldEditorUndoReasons)
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
        const created = await createPaper(
          actor,
          input.format === "rich"
            ? {
                kind: input.kind,
                name: input.name,
                paper: emptyRichPaper(input.kind),
              }
            : input,
          input.format === "rich" ? RICH_NATIVE_WRITER : undefined
        )
        if (input.jobId) {
          await registry.execute({
            name: catalog["job.linkPaper"].name,
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
    "paper.delete": {
      handler: (input, actor) => deletePaper(actor, input.docId),
      reversal: (input, output) =>
        output.format === "word"
          ? {
              command: "paper.recover",
              input: { docId: input.docId },
              expect: {
                query: "paper.read",
                input: { view: "trash", docId: input.docId },
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
    return ownedPaper(actor.userId, input.docId)
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
    read: async (input, actor) => ownedPaper(actor.userId, input.docId),
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
        readOutline(actor.userId, input.docId, input.blockIds, input.cursor),
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
}
