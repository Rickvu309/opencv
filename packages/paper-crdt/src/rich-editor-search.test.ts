import { afterEach, expect, it, vi } from "vitest"
import { TextSelection } from "@tiptap/pm/state"
import * as Y from "yjs"
import {
  nativeProvenance,
  richPaperDocumentSchema,
} from "@workspace/domain/paper-doc"
import { openRichPaperClient } from "./client.js"
import { seedStoredYDoc } from "./stored-document.js"
import { borrowFlowDocument } from "./native-layout-flow.js"
import { mountPrivateFlow } from "./native-layout-flow-mount.js"
import { richEditorSearch } from "./native-layout-search.js"
import { storedFlowFixture } from "./test/flow-fixture.js"

const cleanups = new Set<() => void>()
afterEach(() => {
  for (const cleanup of cleanups) cleanup()
  cleanups.clear()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

function setup(kind: "cv" | "letter", includeTable = false) {
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
    ...section.children.filter(
      (node) =>
        node.type === "header" || (includeTable && node.type === "table")
    ),
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
  const mounted = mountPrivateFlow(lease.binding, host)
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
    client,
    host,
    editor,
    pages: mounted.pages,
    commands,
    select,
    read,
    roundtrip,
    reversible,
    key,
    activeInline: mounted.activeInline,
    setInline: mounted.setInline,
  }
}

it.each(["cv", "letter"] as const)(
  "finds and replaces normalized %s text with marks, one Undo and reload",
  (kind) => {
    const { editor, commands, select, read, roundtrip, host, setInline } =
      setup(kind)
    const scroll = vi.fn()
    Object.defineProperty(Element.prototype, "scrollIntoView", {
      configurable: true,
      value: scroll,
    })
    const search = richEditorSearch(editor)
    cleanups.add(() => search.destroy())
    select()
    setInline({ bold: true })
    select("second")
    setInline({ italic: true })
    editor.setTextCursorPosition("first", "start")
    editor.prosemirrorView.dispatch(
      editor.prosemirrorState.tr.insertText("Earlier typing ")
    )
    const before = read()
    const listener = vi.fn()
    const unsubscribe = search.subscribe(listener)
    search.find("VIE\u0323\u0302T", false)
    expect(search.snapshot().matches).toHaveLength(3)
    expect(host.querySelectorAll(".paper-search-match")).toHaveLength(3)
    expect(search.snapshot().activeIndex).toBe(0)
    search.move(-1)
    expect(search.snapshot().activeIndex).toBe(2)
    search.move(1)
    expect(search.snapshot().activeIndex).toBe(0)
    expect(scroll).toHaveBeenCalled()
    search.find("VIỆT", true)
    expect(search.snapshot().matches).toHaveLength(0)
    search.find("Việt", true)
    expect(search.replace("Career", true)).toBe(3)
    const after = read()
    const first = after.flow.children[0]!.children.find(
      (node) => node.id === "first"
    )
    const second = after.flow.children[0]!.children.find(
      (node) => node.id === "second"
    )
    expect(first).toMatchObject({
      content: [{ text: "Earlier typing first Career e\u0302 😀", bold: true }],
    })
    expect(second).toMatchObject({
      content: [{ text: "second Career e\u0302 😀", italic: true }],
    })
    expect(search.snapshot().matches).toHaveLength(0)
    commands.undo()
    expect(read()).toEqual(before)
    expect(search.snapshot().matches).toHaveLength(3)
    commands.redo()
    expect(read()).toEqual(after)
    roundtrip()
    search.find("ê", false)
    expect(search.snapshot().matches).toHaveLength(3)
    expect(search.replace("é", false)).toBe(1)
    expect(search.snapshot().matches).toHaveLength(2)
    commands.undo()
    editor.isEditable = false
    expect(search.replace("Blocked", true)).toBe(0)
    search.close()
    expect(host.querySelectorAll(".paper-search-match")).toHaveLength(0)
    expect(listener).toHaveBeenCalled()
    unsubscribe()
    search.destroy()
  }
)

it("replaces all matches in four table cells and body text with one Undo", () => {
  const { editor, commands, read, roundtrip, select } = setup("letter", true)
  Object.defineProperty(Element.prototype, "scrollIntoView", {
    configurable: true,
    value: vi.fn(),
  })
  const search = richEditorSearch(editor)
  select()
  const before = read()
  search.find("Việt", false)
  expect(search.snapshot().matches).toHaveLength(7)
  expect(search.replace("Career", true)).toBe(7)
  expect(JSON.stringify(read())).not.toContain("Việt")
  expect(JSON.stringify(read())).toContain("Career")
  commands.undo()
  expect(read()).toEqual(before)
  commands.redo()
  roundtrip()
  search.destroy()
})

it.each([
  ["Việt", "Việta"],
  ["việt", "VIỆT"],
])(
  "advances past %s replaced with %s even when it still matches",
  (query, replacement) => {
    const { editor, commands } = setup("letter")
    const search = richEditorSearch(editor)
    cleanups.add(() => search.destroy())
    search.find(query!, false)
    search.replace(replacement!, false)
    expect(search.snapshot().activeIndex).toBe(1)
    search.replace(replacement!, false)
    expect(search.snapshot().activeIndex).toBe(2)
    expect(editor.prosemirrorState.doc.textContent).not.toContain("Việtaa")
    commands.undo()
    expect(search.snapshot().activeIndex).toBe(2)
    commands.redo()
    expect(search.snapshot().activeIndex).toBe(2)
  }
)

it("tracks the current match through a remote Yjs edit and local Undo and Redo", () => {
  const { client, editor, commands } = setup("letter")
  const search = richEditorSearch(editor)
  cleanups.add(() => search.destroy())
  search.find("việt", false)
  search.move(1)
  search.move(1)
  const current = () =>
    search.snapshot().matches[search.snapshot().activeIndex]!
  const original = current().from
  const remote = openRichPaperClient(client.stored(), {
    provenance: nativeProvenance(client.document()!),
  })
  const lease = borrowFlowDocument(remote.ydoc, "letter")
  const host = document.createElement("div")
  document.body.append(host)
  const mounted = mountPrivateFlow(lease.binding, host)
  cleanups.add(() => {
    mounted.unmount()
    lease.release()
    remote.destroy()
    host.remove()
  })
  mounted.editor.setTextCursorPosition("first", "start")
  mounted.editor.prosemirrorView.dispatch(
    mounted.editor.prosemirrorState.tr.insertText("Remote ")
  )
  Y.applyUpdate(client.ydoc, Y.encodeStateAsUpdate(remote.ydoc))
  expect(search.snapshot().activeIndex).toBe(2)
  expect(current().from).toBe(original + 7)
  editor.setTextCursorPosition("second", "start")
  editor.prosemirrorView.dispatch(
    editor.prosemirrorState.tr.insertText("Local ")
  )
  expect(current().from).toBe(original + 13)
  commands.undo()
  expect(search.snapshot().activeIndex).toBe(2)
  expect(current().from).toBe(original + 7)
  commands.redo()
  expect(search.snapshot().activeIndex).toBe(2)
  expect(current().from).toBe(original + 13)
})
