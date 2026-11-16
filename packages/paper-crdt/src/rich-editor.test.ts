import { afterEach, expect, it, vi } from "vitest"
import { TextSelection } from "@tiptap/pm/state"
import * as Y from "yjs"
import { nativeProvenance, richPaperDocumentSchema } from "@workspace/domain"
import { openRichPaperClient } from "./client.js"
import { seedStoredYDoc } from "./stored-document.js"
import { borrowFlowDocument } from "./native-layout-flow.js"
import { richPageCommands } from "./rich-page-commands.js"
import { richPageLayout } from "./rich-page-layout.js"
import { mountPrivateFlow } from "./native-layout-flow-mount.js"
import { storedFlowFixture } from "./test/flow-fixture.js"

const cleanups = new Set<() => void>()
afterEach(() => {
  for (const cleanup of cleanups) cleanup()
  cleanups.clear()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

function setup(kind: "cv" | "letter") {
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
    host,
    editor,
    pages: richPageCommands(lease.binding, editor),
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
  "keeps %s paragraph styles, nested lists and safe links through Undo, Redo, offline recovery, save and reload",
  (kind) => {
    const {
      host,
      editor,
      commands,
      select,
      read,
      reversible,
      key,
      activeInline,
    } = setup(kind)
    select()
    for (const style of [
      "title",
      "heading-1",
      "heading-2",
      "heading-3",
      "normal",
    ] as const) {
      reversible(() => commands.setParagraphStyle(style))
      expect(commands.formattingState().paragraphStyle).toBe(style)
      expect(
        read().flow.children[0]!.children.find((node) => node.id === "first")
      ).toMatchObject({ paragraph: { paragraphStyle: style } })
    }
    select("first", "second")
    reversible(() => commands.toggleList("bulletListItem"))
    expect(
      host.querySelector('[role="listitem"]')?.getAttribute("style")
    ).toContain("•")
    editor.setTextCursorPosition("second", "start")
    reversible(() => key("Tab"))
    expect(
      read().flow.children[0]!.children.find((node) => node.id === "first")
    ).toMatchObject({
      type: "bullet",
      children: [{ id: "second", type: "bullet" }],
    })
    expect(host.querySelector('[aria-level="2"]')?.textContent).toContain(
      "second Việt"
    )
    editor.setTextCursorPosition("second", "start")
    reversible(() => key("Tab", { shiftKey: true }))
    select("first", "second")
    reversible(() =>
      key("7", { ctrlKey: true, shiftKey: true, code: "Digit7" })
    )
    expect(commands.formattingState().list).toBe("numberedListItem")
    editor.setTextCursorPosition("second", "start")
    reversible(() => key("Tab"))
    expect(
      read().flow.children[0]!.children.find((node) => node.id === "first")
    ).toMatchObject({
      type: "numbered",
      children: [{ id: "second", type: "numbered" }],
    })
    editor.setTextCursorPosition("second", "start")
    reversible(() => key("Tab", { shiftKey: true }))
    select()
    for (const href of [
      "https://example.com/career",
      "http://example.com/work",
      "mailto:linh@example.com",
    ]) {
      reversible(() => expect(commands.setLink(href)).toBe(true))
      expect(commands.formattingState().href).toBe(href)
    }
    for (const href of [
      "javascript:alert(1)",
      "data:text/html,test",
      "ftp://example.com",
      "https://a\u200bb.com",
    ]) {
      const before = read()
      expect(commands.setLink(href)).toBe(false)
      expect(read()).toEqual(before)
    }
    editor.setTextCursorPosition("first", "start")
    expect(commands.formattingState().canLink).toBe(true)
    reversible(() => commands.removeLink())
    select()
    commands.setLink("mailto:linh@example.com")
    commands.setParagraphStyle("heading-2")
    expect(activeInline().bold).toBe(true)
    reversible(() => commands.toggleMark("bold"))
    expect(activeInline().bold).toBe(false)
    for (const keyName of ["b", "i", "u"])
      reversible(() => key(keyName, { ctrlKey: true }))
    reversible(() => key("5", { altKey: true, shiftKey: true, code: "Digit5" }))
    expect(activeInline().strike).toBe(true)
    reversible(() => key("x", { metaKey: true, shiftKey: true }))
    expect(activeInline().strike).toBe(false)
    reversible(() => key("\\", { ctrlKey: true }))
    expect(commands.formattingState().paragraphStyle).toBe("normal")
    const first = read().flow.children[0]!.children.find(
      (node) => node.id === "first"
    )
    expect(first).toMatchObject({
      content: [
        { text: "first Việt e\u0302 😀", href: "mailto:linh@example.com" },
      ],
    })
    expect(first && "content" in first ? first.content : []).toEqual([
      { text: "first Việt e\u0302 😀", href: "mailto:linh@example.com" },
    ])
    select("third")
    reversible(() => key("2", { ctrlKey: true, altKey: true, code: "Digit2" }))
    key("z", { ctrlKey: true })
    expect(commands.formattingState().paragraphStyle).toBe("normal")
    key("z", { ctrlKey: true, shiftKey: true })
    expect(commands.formattingState().paragraphStyle).toBe("heading-2")
  }
)

it.each(["cv", "letter"] as const)(
  "renders all sixteen direct mark combinations on %s links",
  (kind) => {
    const { host, commands, select, setInline } = setup(kind)
    select()
    expect(commands.setLink("https://example.com/career")).toBe(true)
    const marks = ["bold", "italic", "underline", "strike"] as const
    for (let bits = 0; bits < 16; bits++) {
      select()
      setInline(
        Object.fromEntries(
          marks.map((mark, index) => [mark, Boolean(bits & (1 << index))])
        )
      )
      const link = host.querySelector('a[href="https://example.com/career"]')!
      const text = link.querySelector<HTMLElement>("[data-paper-resolved]")!
      const css = getComputedStyle(text)
      expect(css.textDecoration).toBe("")
      expect(css.textDecorationLine).toBe(
        [bits & 4 ? "underline" : "", bits & 8 ? "line-through" : ""]
          .filter(Boolean)
          .join(" ") || "none"
      )
      expect(css.fontWeight).toBe(bits & 1 ? "700" : "400")
      expect(css.fontStyle).toBe(bits & 2 ? "italic" : "normal")
    }
  }
)

it.each(["cv", "letter"] as const)(
  "keeps %s page setup and split-at-caret page breaks through Undo, Redo, save and reload",
  (kind) => {
    const { editor, pages, read, reversible, roundtrip } = setup(kind)
    editor.setTextCursorPosition("first", "start")
    const original = pages.pageSetup()
    reversible(() =>
      pages.setPageSetup({
        width: 16838,
        height: 11906,
        orientation: "landscape",
        top: 720,
        bottom: 1080,
        start: 1440,
        end: 1800,
      })
    )
    expect(read().presentation.page).toEqual(pages.pageSetup())
    expect(
      read().flow.children.every((section) => section.page.width === 16838)
    ).toBe(true)
    expect(() =>
      pages.setPageSetup({ ...original, start: original.width })
    ).toThrow()
    editor.setTextCursorPosition("first", "start")
    const state = editor.prosemirrorState
    editor.prosemirrorView.dispatch(
      state.tr.setSelection(
        TextSelection.create(state.doc, state.selection.from + 5)
      )
    )
    reversible(() => expect(pages.insertPageBreak()).toBe(true))
    const children = read().flow.children[0]!.children
    const index = children.findIndex((node) => node.type === "pageBreak")
    expect(children[index - 1]).toMatchObject({ content: [{ text: "first" }] })
    expect(children[index + 1]).toMatchObject({
      content: [{ text: " Việt e\u0302 😀" }],
    })
    editor.setTextCursorPosition(children[index + 1]!.id, "start")
    reversible(() => expect(pages.removePageBreak(true)).toBe(true))
    expect(
      read().flow.children[0]!.children.some(
        (node) => node.type === "pageBreak"
      )
    ).toBe(false)
    roundtrip()
  }
)

it.each([1232, 390])(
  "keeps every sheet full height at viewport %s",
  (width) => {
    vi.stubGlobal("CSS", {
      ...globalThis.CSS,
      escape: (value: string) => value,
    })
    const fixture = storedFlowFixture()
    const page = {
      width: 12240,
      height: 15840,
      orientation: "portrait",
      top: 1440,
      bottom: 1440,
      start: 1440,
      end: 1440,
    }
    const flow = richPaperDocumentSchema.parse({
      ...fixture,
      presentation: { ...fixture.presentation, page },
      flow: {
        ...fixture.flow,
        children: fixture.flow.children.map((section) => ({
          ...section,
          page,
        })),
      },
    })
    const parent = window.document.createElement("div")
    parent.style.padding = "16px"
    Object.defineProperty(parent, "clientWidth", { value: width })
    const host = window.document.createElement("div")
    host.className = "ProseMirror"
    const content = window.document.createElement("div")
    content.className = "bn-block-group"
    const block = window.document.createElement("div")
    block.dataset.nodeType = "blockOuter"
    block.dataset.id = "break"
    content.append(block)
    host.append(content)
    parent.append(host)
    window.document.body.append(parent)
    cleanups.add(() => parent.remove())
    const scale = Math.min(1, (width - 32) / 816)
    vi.spyOn(host, "getBoundingClientRect").mockReturnValue(
      new DOMRect(0, 100, 816 * scale, 1056 * scale)
    )
    vi.spyOn(content, "getBoundingClientRect").mockReturnValue(
      new DOMRect(0, 100 + 96 * scale, 624 * scale, 1100 * scale)
    )
    vi.spyOn(block, "getBoundingClientRect").mockReturnValue(
      new DOMRect(0, 100 + 196 * scale, 624 * scale, 0)
    )
    expect(richPageLayout(host, flow).get("break")).toBeCloseTo(980)
    expect(host.style.minHeight).toBe("2136px")
    expect(Number(host.style.getPropertyValue("--paper-page-scale"))).toBe(
      scale
    )
    expect(host.style.getPropertyValue("--paper-page-start")).toBe("96px")
  }
)
