import { describe, expect, it } from "vitest"

import {
  BLOCKED_INPUT,
  BROWSER_INPUT_TYPES,
  COMPOSING_INPUT,
  DRAG_NOT_SAVED,
  FORMAT_NOT_SAVED,
  HANDLED_INPUT,
  inputRule,
  pageKey,
} from "./canvas-input.ts"

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

  it("blocks an input type no list names yet, without a notice", () => {
    expect(inputRule("insertSomethingNew")).toEqual({
      kind: "blocked",
      notice: null,
    })
  })

  it("blocks every formatting input with the keyboard formatting notice", () => {
    for (const type of BROWSER_INPUT_TYPES.filter((item) =>
      item.startsWith("format")
    ))
      expect(inputRule(type), type).toEqual({
        kind: "blocked",
        notice: FORMAT_NOT_SAVED,
      })
  })

  it("blocks dragging words with the drag notice", () => {
    expect(inputRule("insertFromDrop")).toEqual({
      kind: "blocked",
      notice: DRAG_NOT_SAVED,
    })
    expect(inputRule("deleteByDrag")).toEqual({
      kind: "blocked",
      notice: DRAG_NOT_SAVED,
    })
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
