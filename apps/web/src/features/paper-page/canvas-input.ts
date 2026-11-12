export const FORMAT_NOT_SAVED =
  "Formatting from the keyboard is not saved yet. Ask the Coach to make words bold or italic."

export const DRAG_NOT_SAVED =
  "Dragging words is not saved yet. Cut and paste them instead."

export const PASTE_TOO_LONG =
  "This paste is too long to save at once. Paste up to 50 lines at a time."

export const BROWSER_INPUT_TYPES = [
  "insertText",
  "insertReplacementText",
  "insertLineBreak",
  "insertParagraph",
  "insertOrderedList",
  "insertUnorderedList",
  "insertHorizontalRule",
  "insertFromYank",
  "insertFromDrop",
  "insertFromPaste",
  "insertFromPasteAsQuotation",
  "insertTranspose",
  "insertCompositionText",
  "insertFromComposition",
  "insertLink",
  "deleteWordBackward",
  "deleteWordForward",
  "deleteSoftLineBackward",
  "deleteSoftLineForward",
  "deleteEntireSoftLine",
  "deleteHardLineBackward",
  "deleteHardLineForward",
  "deleteByDrag",
  "deleteByCut",
  "deleteByComposition",
  "deleteCompositionText",
  "deleteContent",
  "deleteContentBackward",
  "deleteContentForward",
  "historyUndo",
  "historyRedo",
  "formatBold",
  "formatItalic",
  "formatUnderline",
  "formatStrikeThrough",
  "formatSuperscript",
  "formatSubscript",
  "formatJustifyFull",
  "formatJustifyCenter",
  "formatJustifyRight",
  "formatJustifyLeft",
  "formatIndent",
  "formatOutdent",
  "formatRemove",
  "formatSetBlockTextDirection",
  "formatSetInlineTextDirection",
  "formatBackColor",
  "formatFontColor",
  "formatFontName",
] as const

export type PageEdit =
  | { kind: "type" }
  | { kind: "replace" }
  | { kind: "paste" }
  | { kind: "split" }
  | {
      kind: "delete"
      direction: "backward" | "forward"
      reach: "character" | "word" | "line" | "selection"
    }
  | { kind: "undo" }
  | { kind: "redo" }

export type InputRule =
  | { kind: "native" }
  | { kind: "edit"; edit: PageEdit }
  | { kind: "blocked"; notice: string | null }

export const COMPOSING_INPUT = [
  "insertCompositionText",
  "deleteCompositionText",
  "insertFromComposition",
  "deleteByComposition",
] as const

export const HANDLED_INPUT: Readonly<Record<string, PageEdit>> = {
  insertText: { kind: "type" },
  insertReplacementText: { kind: "replace" },
  insertFromPaste: { kind: "paste" },
  insertFromPasteAsQuotation: { kind: "paste" },
  insertParagraph: { kind: "split" },
  insertLineBreak: { kind: "split" },
  deleteContentBackward: {
    kind: "delete",
    direction: "backward",
    reach: "character",
  },
  deleteContentForward: {
    kind: "delete",
    direction: "forward",
    reach: "character",
  },
  deleteContent: { kind: "delete", direction: "backward", reach: "selection" },
  deleteByCut: { kind: "delete", direction: "backward", reach: "selection" },
  deleteWordBackward: { kind: "delete", direction: "backward", reach: "word" },
  deleteWordForward: { kind: "delete", direction: "forward", reach: "word" },
  deleteSoftLineBackward: {
    kind: "delete",
    direction: "backward",
    reach: "line",
  },
  deleteSoftLineForward: {
    kind: "delete",
    direction: "forward",
    reach: "line",
  },
  deleteHardLineBackward: {
    kind: "delete",
    direction: "backward",
    reach: "line",
  },
  deleteHardLineForward: {
    kind: "delete",
    direction: "forward",
    reach: "line",
  },
  historyUndo: { kind: "undo" },
  historyRedo: { kind: "redo" },
}

export const BLOCKED_INPUT: Readonly<Record<string, string | null>> = {
  formatBold: FORMAT_NOT_SAVED,
  formatItalic: FORMAT_NOT_SAVED,
  formatUnderline: FORMAT_NOT_SAVED,
  formatStrikeThrough: FORMAT_NOT_SAVED,
  formatSuperscript: FORMAT_NOT_SAVED,
  formatSubscript: FORMAT_NOT_SAVED,
  formatJustifyFull: FORMAT_NOT_SAVED,
  formatJustifyCenter: FORMAT_NOT_SAVED,
  formatJustifyRight: FORMAT_NOT_SAVED,
  formatJustifyLeft: FORMAT_NOT_SAVED,
  formatIndent: FORMAT_NOT_SAVED,
  formatOutdent: FORMAT_NOT_SAVED,
  formatRemove: FORMAT_NOT_SAVED,
  formatSetBlockTextDirection: FORMAT_NOT_SAVED,
  formatSetInlineTextDirection: FORMAT_NOT_SAVED,
  formatBackColor: FORMAT_NOT_SAVED,
  formatFontColor: FORMAT_NOT_SAVED,
  formatFontName: FORMAT_NOT_SAVED,
  insertOrderedList: FORMAT_NOT_SAVED,
  insertUnorderedList: FORMAT_NOT_SAVED,
  insertHorizontalRule: FORMAT_NOT_SAVED,
  insertLink: FORMAT_NOT_SAVED,
  insertFromDrop: DRAG_NOT_SAVED,
  deleteByDrag: DRAG_NOT_SAVED,
  deleteEntireSoftLine: null,
  insertTranspose: null,
  insertFromYank: null,
}

export function inputRule(inputType: string): InputRule {
  if ((COMPOSING_INPUT as readonly string[]).includes(inputType))
    return { kind: "native" }
  const edit = HANDLED_INPUT[inputType]
  if (edit) return { kind: "edit", edit }
  return { kind: "blocked", notice: BLOCKED_INPUT[inputType] ?? null }
}

export type PageKey = "split" | "undo" | "redo" | null

export function pageKey(event: {
  key: string
  ctrlKey: boolean
  metaKey: boolean
  shiftKey: boolean
  altKey: boolean
}): PageKey {
  if (event.key === "Enter") return "split"
  if (!(event.ctrlKey || event.metaKey) || event.altKey) return null
  const key = event.key.toLowerCase()
  if (key === "z") return event.shiftKey ? "redo" : "undo"
  if (key === "y" && !event.shiftKey) return "redo"
  return null
}
