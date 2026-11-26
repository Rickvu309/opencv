import type { Registry } from "../registry/registry.js"
import { registerRichUndo } from "./rich-edit.js"
import { registerWordUndo } from "./word-package/package-edit.js"
import { oldEditorUndoReasons } from "./undo-guard.js"

export function registerPaper(registry: Registry) {
  registry.addUndoGuard("paper.revertEdit", oldEditorUndoReasons)
  registry.addUndoGuard("paper.attachPhoto", oldEditorUndoReasons)
  registry.addUndoGuard("paper.replace", oldEditorUndoReasons)
  registry.addUndoGuard("paper.restore", oldEditorUndoReasons)
  registerWordUndo(registry)
  registerRichUndo(registry)
}
