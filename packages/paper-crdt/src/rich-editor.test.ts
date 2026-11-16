import type { InlinePresentation } from "@workspace/domain/internal/paper-presentation"
import { compileFlowNativeDocx } from "../../../apps/api/src/paper/native-output/formatted.js"
import { readPackageZip } from "../../../apps/api/src/paper/package-zip.js"
import { afterEach, expect, it, vi } from "vitest"
import { TextSelection } from "@tiptap/pm/state"
import * as Y from "yjs"
import { nativeProvenance, richPaperDocumentSchema } from "@workspace/domain"
import { openRichPaperClient } from "./client.js"
import { seedStoredYDoc } from "./stored-document.js"
import { borrowFlowDocument } from "./native-layout-flow.js"
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

const states = [undefined, false, true] as const
const combinations = states.flatMap((bold) =>
  states.flatMap((italic) =>
    states.flatMap((underline) =>
      states.flatMap((strike) =>
        [false, true].flatMap((linked) =>
          [undefined, "#AA0000"].map((color) => ({
            marks: { bold, italic, underline, strike, color },
            linked,
          }))
        )
      )
    )
  )
)

it.each(["cv", "letter"] as const)(
  "matches page, Underline state and Word for every unset/on/off mark combination in a %s",
  async (kind) => {
    vi.stubGlobal("CSS", { escape: (value: string) => value })
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
    const rows = [false, true].flatMap((inheritedUnderline) =>
      combinations.map((combination, index) => ({
        ...combination,
        inheritedUnderline,
        id: `case-${Number(inheritedUnderline)}-${index}`,
      }))
    )
    const source = richPaperDocumentSchema.parse({
      ...input,
      presentation: {
        ...input.presentation,
        inline: { strike: true, color: "#009900" },
        styles: [
          {
            id: "underlined",
            kind: "character",
            parent: null,
            values: { underline: true },
          },
        ],
      },
      flow: {
        ...input.flow,
        children: [
          {
            ...section,
            children: [
              ...section.children.filter((node) => node.type === "header"),
              ...rows.map(({ marks, linked, inheritedUnderline, id }) => ({
                id,
                type: "paragraph",
                paragraph: {},
                content: [
                  {
                    ...marks,
                    characterStyle: inheritedUnderline
                      ? "underlined"
                      : undefined,
                    text: id,
                    href: linked ? "https://example.com/career" : undefined,
                  },
                ],
              })),
            ],
          },
        ],
      },
    })
    const server = new Y.Doc()
    Y.applyUpdate(server, seedStoredYDoc(source))
    const provenance = nativeProvenance(source)
    const client = openRichPaperClient(null, { provenance })
    expect(
      client.receive(client.prepare(), {
        provenance,
        epoch: 1,
        revision: 0,
        reset: false,
        stale: false,
        update: Y.encodeStateAsUpdate(server),
        stateVector: Y.encodeStateVector(server),
      }).failed
    ).toBe(false)
    const lease = borrowFlowDocument(client.ydoc, kind)
    const host = document.createElement("div")
    document.body.append(host)
    const mounted = mountPrivateFlow(lease.binding, host)
    cleanups.add(() => {
      mounted.unmount()
      lease.release()
      client.ydoc.destroy()
      server.destroy()
      host.remove()
    })
    const { version, schemaRevision, ...flow } = source
    expect([version, schemaRevision]).toEqual([4, 2])
    const compiled = compileFlowNativeDocx({ document: flow })
    if (compiled.kind === "refused") throw new Error(compiled.reason)
    const { files } = await readPackageZip(compiled.value)
    const xmlPart = (name: string) => {
      const xml = files.get(name)
      if (!xml) throw new Error(`Missing Word part ${name}`)
      return {
        root: new DOMParser().parseFromString(
          xml.toString("utf8"),
          "application/xml"
        ).documentElement,
      }
    }
    const wordNamespace =
      "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
    const elements = (root: Element, name: string) =>
      Array.from(root.getElementsByTagNameNS(wordNamespace, name))
    const attribute = (node: Element, name: string) =>
      node.getAttributeNS(wordNamespace, name) ?? undefined
    const one = (root: Element, name: string) => {
      const found = elements(root, name)
      expect(found).toHaveLength(1)
      return found[0]!
    }
    const part = xmlPart("word/document.xml")
    const styles = xmlPart("word/styles.xml")
    const defaults = one(one(styles.root, "docDefaults"), "rPr")
    const namedStyles = new Map(
      elements(styles.root, "style").map((style) => [
        attribute(style, "styleId"),
        style,
      ])
    )
    const wordRuns = new Map(
      elements(part.root, "r").map((run) => [run.textContent ?? "", run])
    )
    const spans = new Map(
      [...host.querySelectorAll<HTMLElement>("[data-paper-resolved]")].map(
        (span) => [span.textContent, span]
      )
    )
    const checkedActiveStates = new Set<string>()
    for (const { marks, linked, inheritedUnderline, id } of rows) {
      const span = spans.get(id)
      const run = wordRuns.get(id)
      if (!span || !run) throw new Error(`Missing rendered run ${id}`)
      const expected = {
        underline: marks.underline ?? (linked || inheritedUnderline),
        strike: marks.strike ?? true,
        color: linked ? "#1D4ED8" : (marks.color ?? "#009900"),
      }
      const color = document.createElement("span")
      color.style.color = expected.color
      const page = {
        underline: span.style.textDecorationLine.includes("underline"),
        strike: span.style.textDecorationLine.includes("line-through"),
        color: span.style.color,
      }
      const runStyle = elements(run, "rStyle")[0]
      const namedStyle = runStyle && namedStyles.get(attribute(runStyle, "val"))
      const sources = namedStyle ? [run, namedStyle, defaults] : [run, defaults]
      const value = (name: string) => {
        for (const source of sources) {
          const property = elements(source, name)[0]
          if (property) return attribute(property, "val")
        }
      }
      const word = {
        underline: value("u") === "single",
        strike: value("strike") === "1",
        color: `#${value("color")}`,
      }
      expect(page, id).toEqual({ ...expected, color: color.style.color })
      expect(word, id).toEqual(expected)
      const wordColor = document.createElement("span")
      wordColor.style.color = word.color
      expect(page, id).toEqual({ ...word, color: wordColor.style.color })
      expect(span.style.fontWeight, id).toBe(marks.bold ? "700" : "400")
      expect(span.style.fontStyle, id).toBe(marks.italic ? "italic" : "normal")
      const activeState = `${linked}:${marks.underline}:${inheritedUnderline}`
      if (checkedActiveStates.has(activeState)) continue
      checkedActiveStates.add(activeState)
      mounted.editor.setTextCursorPosition(id, "start")
      const state = mounted.editor.prosemirrorState
      mounted.editor.prosemirrorView.dispatch(
        state.tr.setSelection(
          TextSelection.create(
            state.doc,
            state.selection.from,
            state.selection.from + id.length
          )
        )
      )
      const active: InlinePresentation = mounted.activeInline()
      expect(active.underline, id).toBe(page.underline)
    }
  },
  60_000
)
