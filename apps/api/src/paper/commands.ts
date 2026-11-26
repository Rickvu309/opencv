import { tableQuery } from "../registry/bind.js"
import type { Registry } from "../registry/registry.js"
import { registerPaperUndo } from "./package-edit.js"
import { oldEditorUndoReasons } from "./undo-guard.js"
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
}
