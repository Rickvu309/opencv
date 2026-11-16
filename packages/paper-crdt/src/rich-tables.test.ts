import {
  flowPaginationSupport,
  installFlowView,
} from "./native-layout-flow-view.js"
import { afterEach, expect, it, vi } from "vitest"
import { TextSelection } from "@tiptap/pm/state"
import * as Y from "yjs"
import { nativeProvenance, richPaperDocumentSchema } from "@workspace/domain"
import {
  flowSectionSchema,
  prepareFlowTableEdit,
} from "@workspace/domain/internal/paper-presentation"
import { openRichPaperClient } from "./client.js"
import { seedStoredYDoc } from "./stored-document.js"
import { borrowFlowDocument } from "./native-layout-flow.js"
import { mountRichPaperEditor } from "./editor.js"
import { mountPrivateFlow } from "./native-layout-flow-mount.js"
import { flowFixture, storedFlowFixture } from "./test/flow-fixture.js"

const cleanups = new Set<() => void>()
afterEach(() => {
  for (const cleanup of cleanups) cleanup()
  cleanups.clear()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

function setup(kind: "cv" | "letter", docsTables = true) {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    }
  )
  Object.defineProperty(window.document, "fonts", {
    configurable: true,
    value: { ready: Promise.resolve() },
  })
  Object.defineProperty(Range.prototype, "getClientRects", {
    configurable: true,
    value: () => [],
  })
  Object.defineProperty(Range.prototype, "getBoundingClientRect", {
    configurable: true,
    value: () => new DOMRect(),
  })
  const input = storedFlowFixture(kind)
  const section = input.flow.children[0]!
  const children = [
    ...section.children.filter((node) => node.type === "header"),
    ...["first", "second", "third"].map((id) => ({
      id,
      type: "paragraph" as const,
      paragraph: {},
      content: [{ text: `${id} Việt e\u0302 😀` }],
    })),
  ]
  const document = richPaperDocumentSchema.parse({
    ...input,
    flow: { ...input.flow, children: [{ ...section, children }] },
  })
  const server = new Y.Doc()
  Y.applyUpdate(server, seedStoredYDoc(document))
  const provenance = nativeProvenance(document)
  const reply = () => ({
    provenance,
    epoch: 1,
    revision: 0,
    reset: false,
    stale: false,
    update: Y.encodeStateAsUpdate(server),
    stateVector: Y.encodeStateVector(server),
  })
  const client = openRichPaperClient(null, { provenance })
  expect(client.receive(client.prepare(), reply()).failed).toBe(false)
  const lease = borrowFlowDocument(client.ydoc, kind)
  const host = window.document.createElement("div")
  window.document.body.append(host)
  const mounted = mountPrivateFlow(lease.binding, host, undefined, docsTables)
  const editor = mounted.editor
  const commands = mounted.commands
  cleanups.add(() => {
    mounted.unmount()
    lease.release()
    client.ydoc.destroy()
    server.destroy()
    host.remove()
  })
  const select = (start = "first", end = start) => {
    editor.setTextCursorPosition(start, "start")
    const from = editor.prosemirrorState.selection.from
    editor.setTextCursorPosition(end, "end")
    const state = editor.prosemirrorState
    editor.prosemirrorView.dispatch(
      state.tr.setSelection(
        TextSelection.create(state.doc, from, state.selection.to)
      )
    )
  }
  const read = () => client.document()!
  const selectTable = () => {
    const table = read().flow.children[0]!.children.find(
      (node) => node.type === "table"
    )
    if (table?.type !== "table") throw new Error("Missing table")
    editor.setTextCursorPosition(
      table.children[0]!.children[0]!.children[0]!.id,
      "start"
    )
  }
  const roundtrip = () => {
    const expected = read()
    const stored = client.stored()
    const offline = openRichPaperClient(stored, { provenance })
    expect(offline.document()).toEqual(expected)
    expect(offline.hasPending()).toBe(client.hasPending())
    offline.ydoc.destroy()
    const sent = client.prepare()
    Y.applyUpdate(server, sent.update)
    expect(client.receive(sent, reply()).failed).toBe(false)
    expect(client.hasPending()).toBe(false)
    const reloaded = openRichPaperClient(client.stored(), { provenance })
    expect(reloaded.document()).toEqual(expected)
    reloaded.ydoc.destroy()
  }
  const reversible = (action: () => void) => {
    const before = read()
    action()
    const after = read()
    expect(after).not.toEqual(before)
    roundtrip()
    expect(commands.formattingState().canUndo).toBe(true)
    commands.undo()
    expect(read()).toEqual(before)
    expect(commands.formattingState().canRedo).toBe(true)
    commands.redo()
    expect(read()).toEqual(after)
    roundtrip()
  }
  const key = (key: string, options: KeyboardEventInit = {}) => {
    const event = new KeyboardEvent("keydown", {
      key,
      bubbles: true,
      cancelable: true,
      ...options,
    })
    editor.prosemirrorView.dom.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(true)
  }
  return {
    host,
    client,
    unmount: mounted.unmount,
    editor,
    commands,
    select,
    selectTable,
    read,
    roundtrip,
    reversible,
    key,
    tables: mounted.tables,
    activeInline: mounted.activeInline,
    setInline: mounted.setInline,
  }
}

it.each(["cv", "letter"] as const)(
  "table row edits are single history steps with durable %s content",
  (kind) => {
    const { tables, select, selectTable, reversible } = setup(kind)
    select("first")
    reversible(() => tables.insertTable(2, 3))
    selectTable()
    reversible(() => tables.addTableRow())
    reversible(() => tables.addTableRow(false))
    reversible(() => tables.removeTableRow())
    reversible(() => tables.removeTable())
  }
)

it.each(["cv", "letter"] as const)(
  "table column edits are single history steps with durable %s widths",
  (kind) => {
    const { tables, select, selectTable, reversible } = setup(kind)
    const active = () => {
      const selected = tables.activeTable()
      if (!selected) throw new Error("No table selected")
      return selected
    }
    select("first")
    reversible(() => tables.insertTable(2, 3))
    selectTable()
    reversible(() => tables.resizeTableColumn(0, 480))
    reversible(() => tables.addTableColumn())
    reversible(() => tables.addTableColumn(false))
    reversible(() => tables.removeTableColumn())
    const before = active().table.columns[0]!.width
    reversible(() => tables.resizeTableColumn(0, before + 300))
    expect(active().table.columns[0]!.width).toBe(before + 300)
  }
)

it.each(["cv", "letter"] as const)(
  "table navigation retains shared formatting and durable %s content",
  (kind) => {
    const {
      tables,
      editor,
      commands,
      select,
      selectTable,
      reversible,
      read,
      key,
    } = setup(kind)
    const active = () => {
      const selected = tables.activeTable()
      if (!selected) throw new Error("No table selected")
      return selected
    }
    select("first")
    reversible(() => tables.insertTable(2, 3))
    selectTable()
    const table = active().table
    const first = table.children[0]!.children[0]!.children[0]!
    editor.setTextCursorPosition(first.id, "start")
    editor.insertInlineContent("Skills Việt 😀")
    commands.setParagraphStyle("heading-2")
    expect(commands.formattingState().paragraphStyle).toBe("heading-2")
    const last = table.children.at(-1)!.children.at(-1)!.children[0]!
    editor.setTextCursorPosition(last.id, "end")
    reversible(() => {
      key("Tab")
      expect(active().rowIndex).toBe(table.children.length)
      expect(active().columnIndex).toBe(0)
    })
    const added = active().table.children.at(-1)!.children[0]!.children[0]!
    editor.setTextCursorPosition(added.id, "start")
    key("Tab", { shiftKey: true })
    expect(active().rowIndex).toBe(table.children.length - 1)
    expect(JSON.stringify(read())).toContain("Skills Việt 😀")
  }
)

it.each(["cell", "body"] as const)(
  "seventy paragraphs in a %s still merge",
  (where) => {
    const { tables, editor, select, read, roundtrip } = setup("letter")
    select("first")
    if (where === "cell") {
      tables.insertTable(2, 2)
      const table = read().flow.children[0]!.children.find(
        (node) => node.type === "table"
      )
      if (table?.type !== "table") throw new Error("Missing table")
      let reference = table.children[0]!.children[0]!.children[0]!.id
      for (let index = 0; index < 70; index += 1) {
        const [added] = editor.insertBlocks(
          [{ type: "paragraph", content: `Line ${index} Việt` }],
          reference,
          "after"
        )
        if (!added) throw new Error("Missing paragraph")
        reference = added.id as typeof reference
      }
      const cell = read().flow.children[0]!.children.find(
        (node) => node.type === "table"
      )
      if (cell?.type !== "table") throw new Error("Missing table")
      expect(cell.children[0]!.children[0]!.children).toHaveLength(71)
    } else {
      let reference = "first"
      for (let index = 0; index < 70; index += 1) {
        const [added] = editor.insertBlocks(
          [{ type: "paragraph", content: `Line ${index} Việt` }],
          reference,
          "after"
        )
        if (!added) throw new Error("Missing paragraph")
        reference = added.id as typeof reference
      }
    }
    expect(read()).toBeTruthy()
    roundtrip()
  }
)

it("refuses nested tables, locked edits and invalid dimensions without changing history", () => {
  const { tables, editor, select, read } = setup("letter")
  select("first")
  for (const [rows, columns] of [
    [0, 2],
    [2, 21],
    [1.5, 1],
  ])
    expect(() => tables.insertTable(rows!, columns!)).toThrow()
  tables.insertTable(1, 1)
  const before = read()
  expect(() => tables.insertTable(1, 1)).toThrow()
  expect(() => tables.removeTableRow()).toThrow()
  expect(() => tables.removeTableColumn()).toThrow()
  editor.isEditable = false
  expect(() => tables.addTableRow()).toThrow()
  expect(read()).toEqual(before)
})

it("leaves Tab on an oversized row for the table menu", () => {
  const { editor, host, tables, select } = setup("letter")
  select("first")
  tables.insertTable(2, 2)
  const row = host.querySelector<HTMLElement>('[data-paper-layout="paperRow"]')
  if (!row) throw new Error("Missing row")
  row.dataset.paperOversizedRow = "true"
  row.tabIndex = 0
  const before = editor.prosemirrorState.selection.from
  const event = new KeyboardEvent("keydown", {
    key: "Tab",
    bubbles: true,
    cancelable: true,
  })
  row.dispatchEvent(event)
  expect(event.defaultPrevented).toBe(false)
  expect(editor.prosemirrorState.selection.from).toBe(before)
})

it("keeps an editable paragraph when deleting the only table", () => {
  const document = flowFixture()
  const section = document.flow.children[0]!
  const table = section.children.find((node) => node.type === "table")!
  section.children = [table]
  const result = prepareFlowTableEdit(
    document,
    { kind: "remove-table", tableId: table.id },
    "replacement-paragraph"
  )
  expect(result).toMatchObject({ kind: "ok" })
  if (result.kind === "ok")
    expect(result.value.flow.children[0]!.children).toEqual([
      {
        id: "replacement-paragraph",
        type: "paragraph",
        paragraph: {},
        content: [],
      },
    ])
})

it("released public table controls cannot read or write the destroyed editor", () => {
  const { client, host, unmount } = setup("cv")
  unmount()
  const editor = mountRichPaperEditor(client, host)
  client.destroy()
  expect(editor.activeTable()).toBeNull()
  expect(editor.tableElement()).toBeNull()
  expect(editor.tableRowElement()).toBeNull()
  for (const action of [
    () => editor.insertTable(2, 2),
    () => editor.addTableRow(),
    () => editor.removeTableRow(),
    () => editor.addTableColumn(),
    () => editor.removeTableColumn(),
    () => editor.resizeTableColumn(0, 600),
    () => editor.removeTable(),
  ])
    expect(action()).toBe(false)
})

it.each([true, false])(
  "table list Tab respects the Docs mount mode %s",
  (docsTables) => {
    const { tables, editor, commands, select, key } = setup(
      "letter",
      docsTables
    )
    select("first")
    tables.insertTable(1, 2)
    commands.toggleList("bulletListItem")
    const first = editor.getTextCursorPosition().block
    editor.updateBlock(first, { content: "First list entry" })
    const [second] = editor.insertBlocks(
      [{ type: "bulletListItem", content: "Second list entry" }],
      first,
      "after"
    )
    editor.setTextCursorPosition(second!.id, "start")
    const before = editor.prosemirrorState.selection.from
    key("Tab")
    if (docsTables) expect(tables.activeTable()?.columnIndex).toBe(1)
    else {
      expect(editor.prosemirrorState.selection.from).toBe(before)
      expect(commands.formattingState().canOutdent).toBe(true)
    }
  }
)

it.each([
  ["Letter", 15840, false],
  ["A4", 16838, false],
  ["Letter on the rich sheet", 15840, true],
] as const)(
  "paginates table rows inside %s margins and bounds an oversized row to its own page",
  async (_, pageHeight, sheet) => {
    vi.stubGlobal("CSS", { supports: () => true, escape: (id: string) => id })
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        disconnect() {}
      }
    )
    Object.defineProperty(document, "fonts", {
      configurable: true,
      value: { ready: Promise.resolve() },
    })
    const input = flowFixture()
    const section = input.flow.children[0]!
    section.page = flowSectionSchema.parse({
      ...section,
      page: { ...section.page, height: pageHeight },
    }).page
    const printable = (pageHeight - section.page.top - section.page.bottom) / 15
    const host = document.createElement("div")
    host.innerHTML =
      '<div data-paper-layout="paperFlowSection" data-paper-id="section-1"><div data-paper-wrap-slot><div data-paper-layout="paperRow"><div></div></div></div></div>'
    const row = host.querySelector<HTMLElement>(
      '[data-paper-layout="paperRow"]'
    )!
    const content = row.firstElementChild!
    const anchor = document.createElement("div")
    anchor.className = "paper-table-anchor"
    row.prepend(anchor)
    const frame = document.createElement("div")
    if (sheet) {
      host.classList.add("paper-rich-sheet")
      Object.defineProperty(frame, "clientWidth", { value: 1400 })
      frame.style.padding = "0px"
      frame.append(host)
      document.body.append(frame)
    } else document.body.append(host)
    const bounds = vi
      .spyOn(content, "getBoundingClientRect")
      .mockReturnValue(new DOMRect(0, 0, 300, printable + 100))
    const view = installFlowView(
      host,
      () => input,
      () => {}
    )
    try {
      await new Promise(requestAnimationFrame)
      expect(flowPaginationSupport(input)).toEqual({
        supported: true,
        reason: null,
      })
      expect(host.dataset.paperPagination).toBe("true")
      expect(row.dataset.paperOversizedRow).toBe("true")
      expect(row.getAttribute("tabindex")).toBe("0")
      expect(row.getAttribute("aria-label")).toBe(
        "Table row taller than a page. Scroll to read all content."
      )
      const rules = host.previousElementSibling?.textContent
      expect(rules).toContain("paperRow]{break-inside:avoid")
      expect(rules).toContain(
        "paper-oversized-row=true]{height:var(--paper-column-height);overflow:auto"
      )
      expect(rules).toContain(
        "paper-oversized-row=true]){break-before:column;break-after:column}"
      )
      expect(rules).toContain(":not([data-paper-reflow=true])")
      if (sheet) expect(host.dataset.paperReflow).toBe("false")
      bounds.mockReturnValue(new DOMRect(0, 0, 300, printable - 10))
      view.schedule()
      await new Promise(requestAnimationFrame)
      expect(row.dataset.paperOversizedRow).toBe("false")
      expect(row.hasAttribute("tabindex")).toBe(false)
    } finally {
      view.destroy()
      host.remove()
      frame.remove()
    }
  }
)

it("keeps a tall row in normal flow while the rich sheet reflows", async () => {
  vi.stubGlobal("CSS", { supports: () => true, escape: (id: string) => id })
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    }
  )
  Object.defineProperty(document, "fonts", {
    configurable: true,
    value: { ready: Promise.resolve() },
  })
  const input = flowFixture()
  const host = document.createElement("div")
  host.classList.add("paper-rich-sheet")
  host.innerHTML =
    '<div data-paper-layout="paperFlowSection" data-paper-id="section-1"><div data-paper-wrap-slot><div data-paper-layout="paperRow"><div></div></div></div></div>'
  const row = host.querySelector<HTMLElement>('[data-paper-layout="paperRow"]')!
  vi.spyOn(row.firstElementChild!, "getBoundingClientRect").mockReturnValue(
    new DOMRect(0, 0, 300, 2000)
  )
  const frame = document.createElement("div")
  Object.defineProperty(frame, "clientWidth", { value: 400 })
  frame.style.padding = "0px"
  frame.append(host)
  document.body.append(frame)
  const view = installFlowView(
    host,
    () => input,
    () => {}
  )
  try {
    await new Promise(requestAnimationFrame)
    expect(host.dataset.paperReflow).toBe("true")
    expect(host.dataset.paperPagination).toBe("true")
    expect(row.dataset.paperOversizedRow).toBe("false")
    expect(row.hasAttribute("tabindex")).toBe(false)
    expect(row.hasAttribute("aria-label")).toBe(false)
  } finally {
    view.destroy()
    frame.remove()
  }
})
