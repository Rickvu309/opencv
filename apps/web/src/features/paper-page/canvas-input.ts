import { WORD_LIMITS } from "@workspace/domain"

export const PASTE_LINE_LIMIT = Math.floor(WORD_LIMITS.maxOpsPerApply / 2)

export const FORMAT_NOT_SAVED =
  "Bold, italic and other formatting typed here are not saved yet. Formatting already in your document is kept. To change it, use Download Word and edit the file in Word."

export const LAYOUT_NOT_SAVED =
  "Alignment, indents and text direction can't be changed here yet. Your document keeps the ones it has. To change them, use Download Word and edit the file in Word."

export const LIST_NOT_SAVED =
  "A line can't be made into a list or taken out of one here yet. Lists already in your document are kept."

export const RULE_NOT_SAVED = "A dividing line can't be added here yet."

export const LINK_NOT_SAVED =
  "Links can't be added here yet. Links already in your document are kept."

export const DRAG_NOT_SAVED =
  "Dragged words were not moved. Cut and paste them instead."

export const PASTE_TOO_MANY_LINES = `Nothing was pasted. One paste can hold up to ${PASTE_LINE_LIMIT} lines.`

export const PASTE_LINE_TOO_LONG = `Nothing was pasted. One pasted line can hold up to ${WORD_LIMITS.maxTextBytes / 1024} KB of text.`

export const TRANSPOSE_NOT_SAVED =
  "Swapping letters is not saved here yet, so nothing changed. Retype them instead."

export const YANK_NOT_SAVED =
  "This kind of paste is not saved here yet, so nothing was pasted. Use Paste instead."

export const CHANGE_NOT_SUPPORTED =
  "This change can't be saved here yet, so it was not made."

export const CHANGE_NOT_KEPT = "Your last change was not kept."

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
  | { kind: "blocked"; notice: string }

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
  deleteEntireSoftLine: {
    kind: "delete",
    direction: "backward",
    reach: "line",
  },
  historyUndo: { kind: "undo" },
  historyRedo: { kind: "redo" },
}

const MARKS = [
  "formatBold",
  "formatItalic",
  "formatUnderline",
  "formatStrikeThrough",
  "formatSuperscript",
  "formatSubscript",
  "formatRemove",
  "formatBackColor",
  "formatFontColor",
  "formatFontName",
] as const

const LAYOUT = [
  "formatJustifyFull",
  "formatJustifyCenter",
  "formatJustifyRight",
  "formatJustifyLeft",
  "formatIndent",
  "formatOutdent",
  "formatSetBlockTextDirection",
  "formatSetInlineTextDirection",
] as const

export const BLOCKED_INPUT: Readonly<Record<string, string>> = {
  ...Object.fromEntries(MARKS.map((type) => [type, FORMAT_NOT_SAVED])),
  ...Object.fromEntries(LAYOUT.map((type) => [type, LAYOUT_NOT_SAVED])),
  insertOrderedList: LIST_NOT_SAVED,
  insertUnorderedList: LIST_NOT_SAVED,
  insertHorizontalRule: RULE_NOT_SAVED,
  insertLink: LINK_NOT_SAVED,
  insertFromDrop: DRAG_NOT_SAVED,
  deleteByDrag: DRAG_NOT_SAVED,
  insertTranspose: TRANSPOSE_NOT_SAVED,
  insertFromYank: YANK_NOT_SAVED,
}

export function inputRule(inputType: string): InputRule {
  if ((COMPOSING_INPUT as readonly string[]).includes(inputType))
    return { kind: "native" }
  const edit = HANDLED_INPUT[inputType]
  if (edit) return { kind: "edit", edit }
  return {
    kind: "blocked",
    notice: BLOCKED_INPUT[inputType] ?? CHANGE_NOT_SUPPORTED,
  }
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
