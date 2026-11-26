import { describe, expect, it } from "vitest"

import { wordConfirmedOpsSchema } from "@workspace/domain/paper-doc"

import { KEPT_PART_LINE, NUMBERED_LINE } from "./canvas-fixed-lines.ts"
import {
  BLOCKED_INPUT,
  BROWSER_INPUT_TYPES,
  CHANGE_NOT_SUPPORTED,
  COMPOSING_INPUT,
  DRAG_NOT_SAVED,
  FORMAT_NOT_SAVED,
  HANDLED_INPUT,
  inputRule,
  LAYOUT_NOT_SAVED,
  LINK_NOT_SAVED,
  LIST_NOT_SAVED,
  PASTE_LINE_LIMIT,
  PASTE_LINE_TOO_LONG,
  PASTE_TOO_MANY_LINES,
  pageKey,
  RULE_NOT_SAVED,
  TRANSPOSE_NOT_SAVED,
  YANK_NOT_SAVED,
} from "./canvas-input.ts"

const NOTE_FOR_INPUT: Record<string, string> = {
  formatBold: FORMAT_NOT_SAVED,
  formatItalic: FORMAT_NOT_SAVED,
  formatUnderline: FORMAT_NOT_SAVED,
  formatStrikeThrough: FORMAT_NOT_SAVED,
  formatSuperscript: FORMAT_NOT_SAVED,
  formatSubscript: FORMAT_NOT_SAVED,
  formatRemove: FORMAT_NOT_SAVED,
  formatBackColor: FORMAT_NOT_SAVED,
  formatFontColor: FORMAT_NOT_SAVED,
  formatFontName: FORMAT_NOT_SAVED,
  formatJustifyFull: LAYOUT_NOT_SAVED,
  formatJustifyCenter: LAYOUT_NOT_SAVED,
  formatJustifyRight: LAYOUT_NOT_SAVED,
  formatJustifyLeft: LAYOUT_NOT_SAVED,
  formatIndent: LAYOUT_NOT_SAVED,
  formatOutdent: LAYOUT_NOT_SAVED,
  formatSetBlockTextDirection: LAYOUT_NOT_SAVED,
  formatSetInlineTextDirection: LAYOUT_NOT_SAVED,
  insertOrderedList: LIST_NOT_SAVED,
  insertUnorderedList: LIST_NOT_SAVED,
  insertHorizontalRule: RULE_NOT_SAVED,
  insertLink: LINK_NOT_SAVED,
  insertFromDrop: DRAG_NOT_SAVED,
  deleteByDrag: DRAG_NOT_SAVED,
  insertTranspose: TRANSPOSE_NOT_SAVED,
  insertFromYank: YANK_NOT_SAVED,
}

const EVERY_NOTE = [
  FORMAT_NOT_SAVED,
  LAYOUT_NOT_SAVED,
  LIST_NOT_SAVED,
  RULE_NOT_SAVED,
  LINK_NOT_SAVED,
  DRAG_NOT_SAVED,
  PASTE_TOO_MANY_LINES,
  PASTE_LINE_TOO_LONG,
  TRANSPOSE_NOT_SAVED,
  YANK_NOT_SAVED,
  CHANGE_NOT_SUPPORTED,
  NUMBERED_LINE,
  KEPT_PART_LINE,
]

const key = (
  name: string,
  mods: Partial<Record<"ctrlKey" | "metaKey" | "shiftKey" | "altKey", boolean>>
) => ({
  key: name,
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
  altKey: false,
  ...mods,
})

describe("the writing page's input rule", () => {
  it("names every input type a browser can send on exactly one list", () => {
    for (const type of BROWSER_INPUT_TYPES) {
      const lists = [
        (COMPOSING_INPUT as readonly string[]).includes(type),
        type in HANDLED_INPUT,
        type in BLOCKED_INPUT,
      ].filter(Boolean)
      expect(lists, type).toHaveLength(1)
    }
    const listed = [
      ...COMPOSING_INPUT,
      ...Object.keys(HANDLED_INPUT),
      ...Object.keys(BLOCKED_INPUT),
    ]
    expect(
      listed.filter((type) => !BROWSER_INPUT_TYPES.includes(type as never))
    ).toEqual([])
  })

  it("leaves only composition to the browser, so Vietnamese and other IME typing keeps working", () => {
    const native = BROWSER_INPUT_TYPES.filter(
      (type) => inputRule(type).kind === "native"
    )
    expect(native).toEqual([
      "insertCompositionText",
      "insertFromComposition",
      "deleteByComposition",
      "deleteCompositionText",
    ])
  })

  it("blocks an input type no list names yet and says the change was not made", () => {
    expect(inputRule("insertSomethingNew")).toEqual({
      kind: "blocked",
      notice: CHANGE_NOT_SUPPORTED,
    })
  })

  it("never blocks an input type silently", () => {
    for (const type of BROWSER_INPUT_TYPES) {
      const rule = inputRule(type)
      if (rule.kind === "blocked") expect(rule.notice, type).not.toBe("")
    }
  })

  it("pins each blocked input type to the note for its own case", () => {
    const blocked = BROWSER_INPUT_TYPES.filter(
      (type) => inputRule(type).kind === "blocked"
    )
    expect(blocked.toSorted()).toEqual(Object.keys(NOTE_FOR_INPUT).toSorted())
    for (const type of blocked)
      expect(inputRule(type), type).toEqual({
        kind: "blocked",
        notice: NOTE_FOR_INPUT[type],
      })
  })

  it("gives each case a note of its own", () => {
    expect(new Set(EVERY_NOTE).size).toBe(EVERY_NOTE.length)
  })

  it("says the paste limits the save holds", () => {
    expect(PASTE_TOO_MANY_LINES).toContain(`${PASTE_LINE_LIMIT} lines`)
    expect(PASTE_LINE_TOO_LONG).toContain("8 KB")
  })

  it("never sends a person to the Coach for a change Word edits cannot make", () => {
    const ops = wordConfirmedOpsSchema.element.options.map(
      (option) => option.shape.op.value
    )
    expect(ops.toSorted()).toEqual(["delete", "insert", "setText"])
    for (const note of EVERY_NOTE) expect(note).not.toMatch(/Coach/)
  })

  it("reads Enter, Undo and Redo keys and leaves Tab and formatting keys alone", () => {
    expect(pageKey(key("Enter", {}))).toBe("split")
    expect(pageKey(key("Enter", { shiftKey: true }))).toBe("split")
    expect(pageKey(key("z", { ctrlKey: true }))).toBe("undo")
    expect(pageKey(key("z", { metaKey: true }))).toBe("undo")
    expect(pageKey(key("Z", { ctrlKey: true, shiftKey: true }))).toBe("redo")
    expect(pageKey(key("z", { metaKey: true, shiftKey: true }))).toBe("redo")
    expect(pageKey(key("y", { ctrlKey: true }))).toBe("redo")
    expect(pageKey(key("z", { ctrlKey: true, altKey: true }))).toBeNull()
    expect(pageKey(key("Tab", {}))).toBeNull()
    expect(pageKey(key("Tab", { shiftKey: true }))).toBeNull()
    expect(pageKey(key("b", { ctrlKey: true }))).toBeNull()
    expect(pageKey(key("z", {}))).toBeNull()
  })
})
