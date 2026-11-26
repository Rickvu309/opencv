import { tableQuery } from "../registry/bind.js"
import type { Registry } from "../registry/registry.js"
import { registerPaperUndo } from "./package-edit.js"
import { oldEditorUndoReasons } from "./undo-guard.js"
import { readOutline } from "./outline.js"
import { coachPaperList } from "./coach-word-pages.js"
import { listPapers } from "./store.js"

export function registerPaper(registry: Registry) {
  registry.addUndoGuard("paper.revertEdit", oldEditorUndoReasons)
  registry.addUndoGuard("paper.attachPhoto", oldEditorUndoReasons)
  registry.addUndoGuard("paper.replace", oldEditorUndoReasons)
  registry.addUndoGuard("paper.restore", oldEditorUndoReasons)
  registerPaperUndo(registry)

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
}
