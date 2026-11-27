import { useReducer } from "react"
import { afterEach, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import {
  nativeProvenance,
  richPaperDocumentSchema,
} from "@workspace/domain/paper-doc"
import { openRichPaperClient, seedStoredYDoc } from "@workspace/paper-crdt"
import { mountRichPaperEditor } from "@workspace/paper-crdt/editor"
import * as editors from "@workspace/paper-crdt/editor"
import { RichFindBar, type PaperFindMode } from "./rich-find-bar"
import { mountRichEditorLifecycle } from "./rich-editor-lifecycle"

const releases: (() => void)[] = []
const liveFonts = Object.getOwnPropertyDescriptor(document, "fonts")
afterEach(() => {
  cleanup()
  for (const release of releases.splice(0)) release()
  if (liveFonts) Object.defineProperty(document, "fonts", liveFonts)
  else Reflect.deleteProperty(document, "fonts")
  vi.restoreAllMocks()
})

function prepareDOM() {
  Object.defineProperty(document, "fonts", {
    configurable: true,
    value: { ready: Promise.resolve() },
  })
  Object.defineProperty(Element.prototype, "scrollIntoView", {
    configurable: true,
    value: vi.fn(),
  })
  Object.defineProperty(Range.prototype, "getClientRects", {
    configurable: true,
    value: () => [],
  })
  Object.defineProperty(Range.prototype, "getBoundingClientRect", {
    configurable: true,
    value: () => new DOMRect(),
  })
}

function setup(available = true) {
  prepareDOM()
  const client = searchClient()
  const host = document.createElement("div")
  document.body.append(host)
  const editor = mountRichPaperEditor(client, host)
  releases.push(() => {
    editor.destroy()
    client.destroy()
    host.remove()
  })
  function Mounted() {
    const [mode, setMode] = useReducer(
      (_: PaperFindMode, mode: PaperFindMode) => mode,
      available ? "closed" : "replace"
    )
    return (
      <RichFindBar
        editor={available ? editor : null}
        disabled={!available}
        mode={mode}
        onModeChange={setMode}
      />
    )
  }
  render(<Mounted />)
  return { host, editor }
}

it("rejects captured search calls after the mounted editor is released", () => {
  prepareDOM()
  const mount = vi.spyOn(editors, "mountRichPaperEditor")
  const client = searchClient()
  const host = document.createElement("div")
  document.body.append(host)
  const mounted =
    vi.fn<(editor: ReturnType<typeof mountRichPaperEditor>) => void>()
  const detach = mountRichEditorLifecycle(client, host, {
    mounted,
    released: vi.fn(),
    failed: vi.fn(),
  })
  releases.push(() => {
    detach()
    client.destroy()
    host.remove()
  })
  const raw = mount.mock.results[0]
  const editor = mounted.mock.calls[0]?.[0]
  if (raw?.type !== "return" || !editor) throw new Error("Editor did not mount")
  const methods = [
    "find",
    "move",
    "replace",
    "close",
    "snapshot",
    "subscribe",
  ] as const
  const spies = methods.map((method) => vi.spyOn(raw.value.search, method))
  const stale = editor.search
  const find = stale.find
  find("Ann", false)
  expect(stale.snapshot().matches).toHaveLength(2)
  detach()
  for (const spy of spies) spy.mockClear()
  find("Ann", false)
  stale.move(1)
  stale.close()
  expect(stale.replace("Anna", false)).toBe(0)
  expect(stale.snapshot()).toEqual({
    query: "",
    matchCase: false,
    matches: [],
    activeIndex: -1,
  })
  expect(stale.snapshot()).toBe(stale.snapshot())
  stale.subscribe(vi.fn())()
  for (const spy of spies) expect(spy).not.toHaveBeenCalled()
})

it("opens with Ctrl+F, navigates with Enter and Shift+Enter, ignores IME and returns focus on Escape", () => {
  const { host } = setup()
  fireEvent.keyDown(window, { key: "f", ctrlKey: true })
  const find = screen.getByRole("textbox", { name: "Find in document" })
  expect(find).toHaveFocus()
  fireEvent.change(find, { target: { value: "Ann" } })
  expect(screen.getByRole("status")).toHaveTextContent("1 of 2")
  fireEvent.keyDown(find, { key: "Enter", isComposing: true })
  expect(screen.getByRole("status")).toHaveTextContent("1 of 2")
  fireEvent.keyDown(find, { key: "Enter" })
  expect(screen.getByRole("status")).toHaveTextContent("2 of 2")
  fireEvent.keyDown(find, { key: "Enter", shiftKey: true })
  expect(screen.getByRole("status")).toHaveTextContent("1 of 2")
  fireEvent.keyDown(find, { key: "Escape", isComposing: true })
  expect(screen.getByRole("search")).toBeInTheDocument()
  fireEvent.keyDown(find, { key: "Escape" })
  expect(screen.queryByRole("search")).not.toBeInTheDocument()
  expect(host).toHaveFocus()
})

it("opens Replace with Ctrl+H and Cmd+Shift+H and moves past an expanding replacement", () => {
  const { host } = setup()
  fireEvent.keyDown(window, { key: "H", metaKey: true, shiftKey: true })
  const find = screen.getByRole("textbox", { name: "Find in document" })
  expect(find).toHaveFocus()
  fireEvent.change(find, { target: { value: "Ann" } })
  fireEvent.change(screen.getByRole("textbox", { name: "Replace with" }), {
    target: { value: "Anna" },
  })
  fireEvent.click(screen.getByRole("button", { name: "Replace" }))
  expect(screen.getByRole("status")).toHaveTextContent("2 of 2")
  fireEvent.click(screen.getByRole("button", { name: "Replace" }))
  expect(host).toHaveTextContent("Anna Anna")
  expect(host).not.toHaveTextContent("Annaa")
  fireEvent.keyDown(find, { key: "Escape" })
  fireEvent.keyDown(window, { key: "h", ctrlKey: true })
  expect(
    screen.getByRole("textbox", { name: "Replace with" })
  ).toBeInTheDocument()
  fireEvent.change(screen.getByRole("textbox", { name: "Find in document" }), {
    target: { value: "absent" },
  })
  expect(screen.getByRole("status")).toHaveTextContent("No matches")
  expect(screen.getAllByText("No matches")).toHaveLength(1)
  expect(screen.getByRole("button", { name: "Replace all" })).toBeDisabled()
})

it("does not navigate from the Match case checkbox or open a shortcut during composition", () => {
  const { editor } = setup()
  fireEvent.keyDown(window, { key: "h", ctrlKey: true, isComposing: true })
  expect(screen.queryByRole("search")).not.toBeInTheDocument()
  fireEvent.keyDown(window, { key: "h", ctrlKey: true })
  fireEvent.change(screen.getByRole("textbox", { name: "Find in document" }), {
    target: { value: "Ann" },
  })
  fireEvent.click(screen.getByRole("button", { name: "Find options" }))
  const checkbox = screen.getByRole("checkbox", { name: "Match case" })
  fireEvent.keyDown(checkbox, { key: "Enter" })
  expect(editor.search.snapshot().activeIndex).toBe(0)
  fireEvent.click(checkbox)
  expect(editor.search.snapshot().matchCase).toBe(true)
})

it("disables the find controls when there is no editor", () => {
  setup(false)
  expect(
    screen.getByRole("textbox", { name: "Find in document" })
  ).toBeDisabled()
  expect(screen.getByRole("button", { name: "Find options" })).toBeDisabled()
  expect(screen.getByRole("button", { name: "Replace all" })).toBeDisabled()
})

function searchClient() {
  const page = {
    width: 11906,
    height: 16838,
    orientation: "portrait",
    top: 1440,
    bottom: 1440,
    start: 1440,
    end: 1440,
  }
  const document = richPaperDocumentSchema.parse({
    version: 4,
    schemaRevision: 2,
    profile: "private-layout-3",
    kind: "letter",
    presentation: {
      codecVersion: 1,
      page,
      inline: {},
      paragraph: {},
      styles: [],
    },
    flow: {
      id: "flow",
      type: "flow",
      children: [
        {
          id: "section",
          type: "flowSection",
          start: "continuous",
          page,
          columns: { count: 1, gap: 360 },
          children: [
            {
              id: "intro",
              type: "paragraph",
              paragraph: {},
              content: [{ text: "Ann Ann ΟΣ Vie\u0323\u0302t" }],
            },
          ],
        },
      ],
    },
  })
  const provenance = nativeProvenance(document)
  return openRichPaperClient(
    {
      epoch: 1,
      revision: 0,
      provenance,
      server: seedStoredYDoc(document),
      pending: new Uint8Array([0, 0]),
    },
    { provenance }
  )
}
