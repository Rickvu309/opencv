import type { Registry } from "../registry/registry.js"
import { registerPaperRevert } from "./operations/revert/undo.js"
import { registerRichUndo } from "./rich-edit.js"
import { oldEditorUndoReasons } from "./undo-guard.js"

export function registerPaper(registry: Registry) {
  registry.addUndoGuard("paper.revertEdit", oldEditorUndoReasons)
  registry.addUndoGuard("paper.attachPhoto", oldEditorUndoReasons)
  registry.addUndoGuard("paper.replace", oldEditorUndoReasons)
  registry.addUndoGuard("paper.restore", oldEditorUndoReasons)
  registerRichUndo(registry)
  registerPaperRevert(registry)
}
