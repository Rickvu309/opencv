import { afterEach, describe, expect, it } from "vitest"
import { joinBackward } from "@tiptap/pm/commands"
import { TextSelection } from "@tiptap/pm/state"
import * as Y from "yjs"
import {
  canonical,
  type Result,
} from "@workspace/domain/internal/paper-presentation"
import {
  createPrivateLayout,
  readLayout,
  openLayoutBinary,
  commitLayoutEdit,
  undoLayoutEdit,
  type LayoutBinding,
} from "./native-layout.js"
import { mountPrivateLayout } from "./native-layout-mount.js"
import { layoutCellAt } from "./native-layout-transaction.js"
import { layoutFixture, layoutRow } from "./test/layout-fixture.js"

const bindings = new Set<LayoutBinding>(),
  mounts = new Set<ReturnType<typeof mountPrivateLayout>>(),
  hosts = new Set<HTMLElement>()
afterEach(() => {
  for (const mount of mounts) mount.unmount()
  for (const binding of bindings) {
    binding.engine._tiptapEditor.destroy()
    binding.doc.destroy()
  }
  for (const host of hosts) host.remove()
  bindings.clear()
  mounts.clear()
  hosts.clear()
})
function value<T>(result: Result<T>): T {
  if (result.kind === "refused") throw new Error(result.reason)
  return result.value
}
function setup(input = layoutFixture()) {
  const binding = value(createPrivateLayout(input))
  bindings.add(binding)
  const host = document.createElement("div")
  document.body.append(host)
  hosts.add(host)
  const mount = mountPrivateLayout(binding, host)
  mounts.add(mount)
  return { binding, host, mount, editor: mount.editor }
}
type Editor = ReturnType<typeof setup>["editor"]
function caret(editor: Editor, id = "r1-a-p", offset = 0) {
  editor.setTextCursorPosition(id, "start")
  const state = editor.prosemirrorState
  editor.prosemirrorView.dispatch(
    state.tr.setSelection(
      TextSelection.create(state.doc, state.selection.from + offset)
    )
  )
}
function range(editor: Editor, start: string, end: string) {
  caret(editor, start)
  const from = editor.prosemirrorState.selection.from
  editor.setTextCursorPosition(end, "end")
  const state = editor.prosemirrorState
  editor.prosemirrorView.dispatch(
    state.tr.setSelection(
      TextSelection.create(state.doc, from, state.selection.to)
    )
  )
}
function table(binding: LayoutBinding) {
  const found = readLayout(binding).flow.children.find(
    (node) => node.type === "table"
  )
  if (!found || found.type !== "table") throw new Error("Missing table")
  return found
}
function roundtrip(binding: LayoutBinding) {
  const fresh = openLayoutBinary(
    Y.encodeStateAsUpdate(binding.doc),
    binding.kind
  )
  bindings.add(fresh)
  expect(readLayout(fresh)).toEqual(readLayout(binding))
}
function paste(host: HTMLElement, plain: string, html?: string) {
  const event = new Event("paste", { bubbles: true, cancelable: true })
  Object.defineProperty(event, "clipboardData", {
    value: {
      getData: (name: string) => (name === "text/html" ? (html ?? "") : plain),
      types: html ? ["text/html", "text/plain"] : ["text/plain"],
      files: [],
    },
  })
  host.dispatchEvent(event)
}
describe("mounted rich table editing", () => {
  it("allows native focus traversal at the outer edges of a table-only Letter", () => {
    const input = layoutFixture()
    input.flow.children = input.flow.children.filter(
      (node) => node.type === "table"
    )
    const { editor, host } = setup(input)
    for (const [id, shiftKey] of [
      ["r1-a-p", true],
      ["r2-b-p", false],
    ] as const) {
      caret(editor, id)
      const event = new KeyboardEvent("keydown", {
        key: "Tab",
        shiftKey,
        bubbles: true,
        cancelable: true,
      })
      host.dispatchEvent(event)
      expect(event.defaultPrevented).toBe(false)
    }
  })
  it("types inherited and explicit marks with English, Vietnamese, combining text and emoji", () => {
    const { binding, editor, mount } = setup()
    caret(editor)
    mount.setInline({ underline: true, bold: false })
    editor.transact((tr) => tr.insertText("Hello Việt e\u0302 😀 "))
    const paragraph = table(binding).children[0]?.children[0]?.children[0]
    expect(
      paragraph && "content" in paragraph && paragraph.content[0]?.text
    ).toContain("Hello Việt")
    expect(
      paragraph && "content" in paragraph && paragraph.content[0]?.bold
    ).toBe(false)
    roundtrip(binding)
  })
  it("splits a paragraph with Enter while preserving cell, row, table and first paragraph identities", () => {
    const { binding, editor, host } = setup(),
      before = table(binding)
    caret(editor, "r1-a-p", 3)
    host.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Enter",
        bubbles: true,
        cancelable: true,
      })
    )
    const next = table(binding)
    expect(next.id).toBe(before.id)
    expect(next.columns).toEqual(before.columns)
    expect(next.children.map((row) => row.id)).toEqual(
      before.children.map((row) => row.id)
    )
    expect(next.children[0]?.children[0]?.id).toBe("r1-a")
    expect(next.children[0]?.children[0]?.children).toHaveLength(2)
    expect(next.children[0]?.children[0]?.children[0]?.id).toBe("r1-a-p")
    roundtrip(binding)
  })
  it("navigates cells with Tab and Shift-Tab and exits through the correct table neighbor", () => {
    const { binding, editor, host } = setup()
    const tab = (shiftKey = false) =>
      host.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Tab",
          shiftKey,
          bubbles: true,
          cancelable: true,
        })
      )
    caret(editor)
    tab()
    expect(layoutCellAt(editor.prosemirrorState.selection.$from)).toBe("r1-b")
    tab(true)
    expect(layoutCellAt(editor.prosemirrorState.selection.$from)).toBe("r1-a")
    tab(true)
    expect(editor.getTextCursorPosition().block.id).toBe("intro")
    caret(editor, "r2-b-p")
    tab()
    expect(editor.getTextCursorPosition().block.id).toBe("after")
    expect(table(binding).children).toHaveLength(2)
  })
  it("refuses Backspace joining across a cell boundary", () => {
    const { binding, editor } = setup()
    caret(editor, "r1-b-p")
    const bytes = Y.encodeStateAsUpdate(binding.doc)
    joinBackward(editor.prosemirrorState, editor.prosemirrorView.dispatch)
    expect(Y.encodeStateAsUpdate(binding.doc)).toEqual(bytes)
    roundtrip(binding)
  })
  it("refuses cross-cell selection deletion and replacement without a Y update", () => {
    const { binding, editor } = setup()
    range(editor, "r1-a-p", "r1-b-p")
    const bytes = Y.encodeStateAsUpdate(binding.doc)
    editor.prosemirrorView.dispatch(
      editor.prosemirrorState.tr.deleteSelection()
    )
    editor.prosemirrorView.dispatch(
      editor.prosemirrorState.tr.insertText("erase")
    )
    expect(Y.encodeStateAsUpdate(binding.doc)).toEqual(bytes)
  })
  it("pastes multiple rich paragraphs into the middle of a cell and joins prefix and suffix", () => {
    const { binding, editor, host } = setup()
    caret(editor, "r1-a-p", 3)
    paste(
      host,
      "Alpha\nBeta",
      "<p><strong>Alpha</strong></p><p><em>Beta</em></p>"
    )
    const cell = table(binding).children[0]?.children[0]
    expect(cell?.children).toHaveLength(2)
    const [first, last] = cell?.children ?? []
    expect(
      first &&
        "content" in first &&
        first.content.map((run) => run.text).join("")
    ).toBe("ViệAlpha")
    expect(
      last && "content" in last && last.content.map((run) => run.text).join("")
    ).toBe("Betat e\u0302 😀")
    expect(
      first &&
        "content" in first &&
        first.content.some((run) => run.text === "Alpha" && run.bold)
    ).toBe(true)
    roundtrip(binding)
  })
  it("pastes plain lines and supports replacement across paragraphs within one cell", () => {
    const { binding, editor, host } = setup()
    caret(editor)
    paste(host, "First\nSecond")
    const cell = table(binding).children[0]?.children[0],
      last = cell?.children.at(-1)
    expect(cell?.children).toHaveLength(2)
    if (!last) throw new Error("Missing pasted paragraph")
    range(editor, "r1-a-p", last.id)
    paste(host, "Replace")
    expect(table(binding).children[0]?.children[0]?.children).toHaveLength(1)
    const p = table(binding).children[0]?.children[0]?.children[0]
    expect(
      p && "content" in p && p.content.map((run) => run.text).join("")
    ).toBe("Replace")
    roundtrip(binding)
  })
  it("pastes headings and lists as rich cell blocks while preserving surrounding text", () => {
    const { binding, editor, host } = setup()
    caret(editor, "r1-a-p", 3)
    paste(host, "Heading\nItem", "<h2>Heading</h2><ul><li>Item</li></ul>")
    const cell = table(binding).children[0]?.children[0]
    expect(cell?.children.map((node) => node.type)).toEqual([
      "paragraph",
      "heading",
      "bullet",
      "paragraph",
    ])
    roundtrip(binding)
  })
  it("keeps external HTML alignment, explicit mark removal, links and nested lists on reopen", () => {
    const { binding, editor, host } = setup()
    caret(editor, "r1-a-p", 3)
    paste(
      host,
      "Aligned\nTop\nNested",
      '<p style="text-align:center"><span style="font-weight:normal;font-style:normal;text-decoration:none">Aligned</span> <a href="https://example.com/career">Career</a></p><ul><li>Top<ol><li><strong>Nested</strong></li></ol></li></ul>'
    )
    const cell = table(binding).children[0]?.children[0]
    const aligned = cell?.children.find(
      (node) =>
        "content" in node &&
        node.content.some((run) => run.text.includes("Aligned"))
    )
    if (!aligned || !("content" in aligned))
      throw new Error("Missing aligned paragraph")
    expect(aligned.paragraph.alignment).toBe("center")
    expect(
      aligned.content.find((run) => run.text.includes("Aligned"))
    ).toMatchObject({
      bold: false,
      italic: false,
      underline: false,
      strike: false,
    })
    expect(aligned.content.find((run) => run.text === "Career")?.href).toBe(
      "https://example.com/career"
    )
    const list = cell?.children.find((node) => node.type === "bullet")
    expect(list?.type === "bullet" && list.children[0]?.type).toBe("numbered")
    expect(
      list?.type === "bullet" &&
        list.children[0] &&
        "content" in list.children[0] &&
        list.children[0].content[0]?.bold
    ).toBe(true)
    roundtrip(binding)
  })
  it("refuses nested table and image paste without discarding existing cell content", () => {
    const { binding, editor, host } = setup()
    caret(editor)
    const bytes = Y.encodeStateAsUpdate(binding.doc)
    paste(host, "Table", "<table><tr><td>Table</td></tr></table>")
    paste(host, "Photo", '<img src="https://example.com/photo.png">')
    expect(Y.encodeStateAsUpdate(binding.doc)).toEqual(bytes)
  })
  it("receives an admitted structural command and durable Undo while mounted", () => {
    const { binding } = setup()
    expect(
      commitLayoutEdit(
        binding,
        "row",
        {
          kind: "insert-row",
          tableId: "table",
          afterId: "r1",
          row: layoutRow("new"),
        },
        canonical(readLayout(binding))
      ).kind
    ).toBe("ok")
    expect(table(binding).children).toHaveLength(3)
    expect(
      undoLayoutEdit(binding, "row", canonical(readLayout(binding))).kind
    ).toBe("ok")
    expect(table(binding).children).toHaveLength(2)
    roundtrip(binding)
  })
  it("renders unequal physical column widths and inherited presentation tokens", () => {
    const { host } = setup()
    expect(host.innerHTML).toContain(
      "--paper-table-columns: minmax(0,3000fr) minmax(0,5000fr)"
    )
    expect(host.innerHTML).toContain("--paper-table-width: 400pt")
    expect(
      host
        .querySelector('[data-paper-layout="paperRow"]')
        ?.firstElementChild?.getAttribute("style")
    ).toContain("grid-template-columns: var(--paper-table-columns)")
    expect(host.querySelector("[data-paper-resolved]")).not.toBeNull()
  })
  it("does not mount twice and releases listeners and editor resources on repeated unmount", () => {
    const { binding, host, mount } = setup()
    expect(() => mountPrivateLayout(binding, host)).toThrow("already mounted")
    mount.unmount()
    mount.unmount()
    expect(() => mount.setInline({ bold: true })).toThrow("unmounted")
  })
})
