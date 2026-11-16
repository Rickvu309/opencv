import { afterEach, describe, expect, it } from "vitest"
import { joinBackward, splitBlock } from "@tiptap/pm/commands"
import { NodeSelection } from "@tiptap/pm/state"
import * as Y from "yjs"
import { cvSlots } from "@workspace/domain"
import {
  formatTargetSchema,
  formatRunsSchema,
  formattedDocumentSchema,
  type FormatTarget,
  type PrivateFormattedDocument,
  type Result,
} from "@workspace/domain/internal/paper-presentation"
import { mountPrivateFormatting } from "./native-formatting-mount.js"
import {
  createPrivateFormatting,
  openFormattedBinary,
  readFormatting,
} from "./native-formatting.js"
import {
  applyFormatting,
  prepareFormatting,
  reverseFormatting,
} from "./presentation-codec.js"
import { canonicalTarget, type EngineBinding } from "./presentation-binding.js"
import { canonicalStyles } from "./native-formatting-styles.js"
import { selectedRuns } from "./presentation-inline.js"
import type { PrivateFormattingEditor } from "./native-formatting-schema.js"

const bindings = new Set<EngineBinding>()
const mounts = new Set<ReturnType<typeof mountPrivateFormatting>>()
const elements = new Set<HTMLElement>()

afterEach(() => {
  for (const mount of mounts) mount.unmount()
  for (const binding of bindings) {
    binding.engine._tiptapEditor.destroy()
    binding.doc.destroy()
  }
  for (const element of elements) element.remove()
  mounts.clear()
  bindings.clear()
  elements.clear()
})

function value<T>(result: Result<T>): T {
  if (result.kind === "refused") throw new Error(result.reason)
  return result.value
}

const presentation = {
  codecVersion: 1,
  page: {
    width: 11906,
    height: 16838,
    orientation: "portrait",
    top: 1440,
    bottom: 1440,
    start: 1440,
    end: 1440,
  },
  inline: { bold: true, fontId: "liberation-serif" },
  paragraph: {},
  styles: [],
}

const bodyTarget = formatTargetSchema.parse({ kind: "body", blockId: "body" })

function letter(): PrivateFormattedDocument {
  return formattedDocumentSchema.parse({
    profile: "private-formatting-1",
    kind: "letter",
    presentation,
    blocks: [
      {
        id: "body",
        type: "paragraph",
        paragraph: { alignment: "right", before: 120, keepNext: false },
        content: [{ text: "Hello" }],
      },
      { id: "empty", type: "paragraph", paragraph: {}, content: [] },
    ],
  })
}

function cv(): PrivateFormattedDocument {
  const fields = (id: string, type: "header" | "section") =>
    cvSlots[type].map((fieldKey) => ({
      id: `${id}-${fieldKey}`,
      type: "cvField",
      ownerId: id,
      fieldKey,
      paragraph: {},
      content: fieldKey === "name" ? [{ text: "Ada" }] : [],
    }))
  return formattedDocumentSchema.parse({
    profile: "private-formatting-1",
    kind: "cv",
    presentation,
    header: {
      id: "header",
      type: "header",
      children: fields("header", "header"),
    },
    blocks: [
      {
        id: "summary1",
        type: "section",
        kind: "summary",
        children: fields("summary1", "section"),
      },
      {
        id: "summary2",
        type: "section",
        kind: "summary",
        children: fields("summary2", "section"),
      },
    ],
  })
}

function binding(input = letter()) {
  const result = value(createPrivateFormatting(input))
  bindings.add(result)
  return result
}

function host() {
  const element = globalThis.document.createElement("div")
  globalThis.document.body.append(element)
  elements.add(element)
  return element
}

function mount(source: EngineBinding, element = host()) {
  const result = mountPrivateFormatting(source, element)
  mounts.add(result)
  return { ...result, element }
}

function caret(editor: PrivateFormattingEditor, id: string, offset = 0) {
  editor.setTextCursorPosition(id, "start")
  editor._tiptapEditor.commands.setTextSelection(
    editor.prosemirrorState.selection.from + offset
  )
}

function inline(source: EngineBinding, target: FormatTarget = bodyTarget) {
  const node = canonicalTarget(readFormatting(source), target)
  if (!("content" in node)) throw new Error("Expected inline target")
  return node
}

function reopened(source: EngineBinding) {
  const fresh = openFormattedBinary(
    Y.encodeStateAsUpdate(source.doc),
    source.kind
  )
  bindings.add(fresh)
  expect(readFormatting(fresh)).toEqual(readFormatting(source))
  return fresh
}

function unchanged(
  source: EngineBinding,
  editor: PrivateFormattingEditor,
  work: () => unknown
) {
  const bytes = Y.encodeStateAsUpdate(source.doc)
  const vector = Y.encodeStateVector(source.doc)
  const before = readFormatting(source)
  const engineBefore = editor.prosemirrorState.doc.toJSON()
  let updates = 0
  const count = () => updates++
  source.doc.on("update", count)
  try {
    work()
    expect(Y.encodeStateAsUpdate(source.doc)).toEqual(bytes)
    expect(Y.encodeStateVector(source.doc)).toEqual(vector)
    expect(readFormatting(source)).toEqual(before)
    expect(editor.prosemirrorState.doc.toJSON()).toEqual(engineBefore)
    expect(updates).toBe(0)
  } finally {
    source.doc.off("update", count)
  }
}

function resolved(element: HTMLElement, text: string) {
  const span = Array.from(
    element.querySelectorAll<HTMLElement>("[data-paper-resolved]")
  ).find((node) => node.textContent === text)
  if (!span) throw new Error(`Missing resolved text: ${text}`)
  return span.style
}

describe("mounted private formatting with real BlockNote, DOM and canonical Yjs", () => {
  it("types directly into the canonical fragment and reopens the changed binary", () => {
    const source = binding()
    const view = mount(source)
    expect(view.editor.prosemirrorView.dom).toBe(view.element)
    expect(view.element.matches("[contenteditable=true]")).toBe(true)
    const fragment = source.fragment
    let updates = 0
    source.doc.on("update", () => updates++)
    caret(view.editor, "body", 5)
    view.editor.transact((tr) => tr.insertText(" Việt e\u0302 😀"))
    expect(inline(source).content).toEqual([{ text: "Hello Việt e\u0302 😀" }])
    expect(inline(source).paragraph).toEqual(
      inline(binding(letter())).paragraph
    )
    expect(source.fragment).toBe(fragment)
    expect(updates).toBeGreaterThan(0)
    expect(inline(reopened(source)).content).toEqual(inline(source).content)
  })

  it("keeps explicit off and inherited marks distinct while rendering their effective values", () => {
    const source = binding()
    const view = mount(source)
    caret(view.editor, "empty")
    view.setInline({
      bold: false,
      italic: false,
      underline: true,
      strike: false,
    })
    view.editor.transact((tr) => tr.insertText("off"))
    view.resetInline()
    expect(canonicalStyles(view.editor.getActiveStyles())).toEqual({})
    view.editor.transact((tr) => tr.insertText("inherit"))
    const target = formatTargetSchema.parse({ kind: "body", blockId: "empty" })
    expect(inline(source, target).content).toEqual([
      {
        text: "off",
        bold: false,
        italic: false,
        underline: true,
        strike: false,
      },
      { text: "inherit" },
    ])
    expect(resolved(view.element, "off").fontWeight).toBe("400")
    expect(resolved(view.element, "off").textDecorationLine).toBe("underline")
    expect(resolved(view.element, "inherit").fontWeight).toBe("700")
    expect(resolved(view.element, "inherit").textDecorationLine).toBe("none")
    reopened(source)
  })

  it("adapts Ctrl+B from inherited bold to explicit off before Unicode typing", () => {
    const source = binding()
    const view = mount(source)
    caret(view.editor, "empty")
    const editable = view.editor.prosemirrorView.dom
    const key = new globalThis.KeyboardEvent("keydown", {
      key: "b",
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    })
    editable.dispatchEvent(key)
    expect(key.defaultPrevented).toBe(true)
    expect(view.editor.getActiveStyles().bold).toBe("off")
    view.editor.transact((tr) => tr.insertText("Việt e\u0302 😀"))
    const target = formatTargetSchema.parse({ kind: "body", blockId: "empty" })
    expect(inline(source, target).content).toEqual([
      { text: "Việt e\u0302 😀", bold: false },
    ])
    view.toggle("bold")
    view.editor.transact((tr) => tr.insertText("on"))
    expect(inline(source, target).content).toContainEqual({
      text: "on",
      bold: true,
    })
    reopened(source)
  })

  it("paints the Word Hyperlink underline when a direct underline mark is off", () => {
    const input = letter()
    input.presentation.inline.underline = true
    const first = input.blocks[0]
    if (!first || first.type !== "paragraph") throw new Error("Missing body")
    first.content = formatRunsSchema.parse([
      { text: "Linked off", href: "https://example.com", underline: false },
      { text: "Linked inherited", href: "https://example.org" },
    ])
    const source = binding(input)
    const view = mount(source)
    expect(resolved(view.element, "Linked off").textDecorationLine).toBe(
      "underline"
    )
    expect(resolved(view.element, "Linked inherited").textDecorationLine).toBe(
      "underline"
    )
    const anchors = view.element.querySelectorAll("a")
    expect(anchors).toHaveLength(2)
    for (const anchor of anchors)
      expect(anchor.style.textDecoration).toBe("none")
    reopened(source)
  })

  it("refuses a second view and permits remounting without rewriting the document", () => {
    const source = binding()
    const before = Y.encodeStateAsUpdate(source.doc)
    const view = mount(source)
    expect(() => mountPrivateFormatting(source, host())).toThrow(
      "already mounted"
    )
    expect(Y.encodeStateAsUpdate(source.doc)).toEqual(before)
    view.unmount()
    view.unmount()
    expect(source.doc.isDestroyed).toBe(false)
    expect(() => view.setInline({ bold: false })).toThrow("unmounted")
    const next = mount(source)
    expect(Y.encodeStateAsUpdate(source.doc)).toEqual(before)
    caret(next.editor, "body", 5)
    next.editor.transact((tr) => tr.insertText(" again"))
    expect(inline(source).content).toEqual([{ text: "Hello again" }])
    reopened(source)
  })

  it("undoes and redoes local typing while keeping approved formatting intact", () => {
    const source = binding()
    const prepared = value(
      prepareFormatting(source, {
        kind: "inline",
        range: { target: bodyTarget, from: 0, to: 5 },
        expected: [{ text: "Hello" }],
        values: { bold: false },
      })
    )
    const view = mount(source)
    caret(view.editor, "body", 5)
    view.editor.transact((tr) => tr.insertText("!"))
    expect(applyFormatting(source, prepared).kind).toBe("ok")
    expect(view.editor.undo()).toBe(true)
    expect(inline(source).content).toEqual([{ text: "Hello", bold: false }])
    expect(view.editor.redo()).toBe(true)
    expect(inline(source).content).toEqual([
      { text: "Hello", bold: false },
      { text: "!" },
    ])
    reopened(source)
  })

  it("renames the CV name as text while preserving every semantic field identity", () => {
    const source = binding(cv())
    const view = mount(source)
    const target = formatTargetSchema.parse({
      kind: "cv-field",
      fieldId: "header-name",
      ownerId: "header",
      fieldKey: "name",
    })
    caret(view.editor, "header-name", 3)
    view.setInline({ bold: false, color: "#123456" })
    view.editor.transact((tr) => tr.insertText(" Việt e\u0302 😀"))
    expect(inline(source, target)).toMatchObject({
      id: "header-name",
      ownerId: "header",
      fieldKey: "name",
      content: [
        { text: "Ada" },
        { text: " Việt e\u0302 😀", bold: false, color: "#123456" },
      ],
    })
    const changed = readFormatting(source)
    const original = cv()
    if (changed.kind !== "cv" || original.kind !== "cv")
      throw new Error("Expected CV")
    expect(changed.header.children.slice(1)).toEqual(
      original.header.children.slice(1)
    )
    expect(changed.blocks).toEqual(original.blocks)
    reopened(source)
  })

  it("rejects CV newlines, identity mutation, splits, merges and reparenting before Yjs changes", () => {
    const source = binding(cv())
    const { editor } = mount(source)
    caret(editor, "header-name", 1)
    unchanged(source, editor, () =>
      editor.transact((tr) => tr.insertText("bad\nfield"))
    )
    unchanged(source, editor, () =>
      editor.updateBlock("header-name", {
        props: { fieldKey: "headline" },
      })
    )
    unchanged(source, editor, () =>
      editor.updateBlock("header-name", {
        props: { ownerId: "summary1" },
      })
    )
    unchanged(source, editor, () =>
      splitBlock(
        editor.prosemirrorState,
        (tr) => editor.prosemirrorView.dispatch(tr),
        editor.prosemirrorView
      )
    )
    caret(editor, "header-headline")
    unchanged(source, editor, () =>
      joinBackward(
        editor.prosemirrorState,
        (tr) => editor.prosemirrorView.dispatch(tr),
        editor.prosemirrorView
      )
    )
    caret(editor, "header-name", 1)
    unchanged(source, editor, () => editor.unnestBlock())
    reopened(source)
  })

  it("moves a complete CV owner with its stable field tuple in one editor transaction", () => {
    const source = binding(cv())
    const { editor } = mount(source)
    const group = editor.prosemirrorState.doc.firstChild
    if (!group || group.childCount !== 3)
      throw new Error("Expected CV owner group")
    const header = group.child(0)
    const a = group.child(1)
    const b = group.child(2)
    editor.prosemirrorView.dispatch(
      editor.prosemirrorState.tr.setSelection(
        NodeSelection.create(editor.prosemirrorState.doc, 1 + header.nodeSize)
      )
    )
    editor.transact((tr) =>
      tr.replaceWith(1, group.nodeSize - 1, [header, b, a])
    )
    const changed = readFormatting(source)
    const original = cv()
    expect(changed.blocks).toEqual([original.blocks[1], original.blocks[0]])
    if (changed.kind !== "cv" || original.kind !== "cv")
      throw new Error("Expected CV")
    expect(changed.header).toEqual(original.header)
    reopened(source)
  })

  it("preserves prepared and reversal handles across mount, typing and remount", () => {
    const source = binding()
    const prepared = value(
      prepareFormatting(source, {
        kind: "inline",
        range: { target: bodyTarget, from: 0, to: 5 },
        expected: [{ text: "Hello" }],
        values: { bold: false, color: "#123456" },
      })
    )
    const view = mount(source)
    caret(view.editor, "body", 5)
    view.editor.transact((tr) => tr.insertText("!"))
    const receipt = value(applyFormatting(source, prepared))
    expect(selectedRuns(inline(source).content, 0, 5)).toEqual([
      { text: "Hello", bold: false, color: "#123456" },
    ])
    expect(resolved(view.element, "Hello").fontWeight).toBe("400")
    view.unmount()
    const next = mount(source)
    expect(reverseFormatting(source, receipt).kind).toBe("ok")
    expect(inline(source).content).toEqual([{ text: "Hello!" }])
    expect(next.editor.document[0]?.id).toBe("body")
    expect(resolved(next.element, "Hello!").fontWeight).toBe("700")
    reopened(source)
  })
})
