import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  cleanup,
} from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import userEvent from "@testing-library/user-event"
import { TextSelection } from "prosemirror-state"
import {
  nativeProvenance,
  richPaperDocumentSchema,
} from "@workspace/domain/paper-doc"
import {
  emptyUpdate,
  openRichPaperClient,
  seedStoredYDoc,
} from "../../../../../../packages/paper-crdt/src/index.ts"
import { mountRichPaperEditor } from "@workspace/paper-crdt/editor"
import * as flowMount from "../../../../../../packages/paper-crdt/src/native-layout-flow-mount.ts"
import { storedFlowFixture } from "../../../../../../packages/paper-crdt/src/test/flow-fixture.ts"
import { TooltipProvider } from "@workspace/ui/components/tooltip"
import { RichLinkDialog } from "./rich-structure-controls.tsx"
import { RichStructureControls } from "./rich-structure-controls"

const disposals: (() => void)[] = []
const liveFonts = Object.getOwnPropertyDescriptor(document, "fonts")
beforeEach(() => {
  vi.useRealTimers()
  vi.stubGlobal("ClipboardEvent", class extends Event {})
  Object.defineProperties(Range.prototype, {
    getClientRects: { configurable: true, value: () => [] },
    getBoundingClientRect: { configurable: true, value: () => new DOMRect() },
  })
  Object.defineProperty(document, "fonts", {
    configurable: true,
    value: { ready: Promise.resolve() },
  })
})
afterEach(() => {
  cleanup()
  for (const dispose of disposals.splice(0)) dispose()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  if (liveFonts) Object.defineProperty(document, "fonts", liveFonts)
  else Reflect.deleteProperty(document, "fonts")
})

function setup() {
  const input = storedFlowFixture("letter")
  const section = input.flow.children[0]!
  const documentValue = richPaperDocumentSchema.parse({
    ...input,
    presentation: {
      ...input.presentation,
      styles: [
        ...input.presentation.styles,
        { id: "custom-career", parent: null, kind: "paragraph", values: {} },
      ],
    },
    flow: {
      ...input.flow,
      children: [
        {
          ...section,
          children: [
            {
              id: "heading",
              type: "heading",
              level: 2,
              paragraph: {},
              content: [{ text: "Experience" }],
            },
            {
              id: "body",
              type: "paragraph",
              paragraph: {},
              content: [{ text: "Body text" }],
            },
          ],
        },
      ],
    },
  })
  const provenance = nativeProvenance(documentValue)
  const client = openRichPaperClient(
    {
      epoch: 1,
      revision: 0,
      provenance,
      server: seedStoredYDoc(documentValue),
      pending: emptyUpdate(),
    },
    { provenance }
  )
  const host = document.createElement("div")
  document.body.append(host)
  const originalMount = flowMount.mountPrivateFlow
  const mounts: ReturnType<typeof originalMount>[] = []
  vi.spyOn(flowMount, "mountPrivateFlow").mockImplementation((...args) => {
    const result = originalMount(...args)
    mounts.push(result)
    return result
  })
  const editor = mountRichPaperEditor(client, host)
  const engine = mounts[0]!.editor
  const view = engine.prosemirrorView
  view.dom.tabIndex = 0
  const controls = render(
    <TooltipProvider>
      <RichLinkDialog editor={editor} blocked={false} />
      <RichStructureControls editor={editor} blocked={false}>
        {null}
      </RichStructureControls>
    </TooltipProvider>
  )
  const caret = (id: string) =>
    act(() => {
      engine.setTextCursorPosition(id, "start")
      editor.focus()
    })
  caret("body")
  disposals.push(() => {
    editor.destroy()
    client.destroy()
    host.remove()
  })
  return { editor, client, host, view, engine, controls, caret }
}

it("shows a semantic heading at a caret and mixed paragraph styles across a selection", () => {
  const { caret, view, engine } = setup()
  caret("heading")
  expect(
    screen.getByRole("combobox", { name: "Paragraph style" })
  ).toHaveTextContent("Heading 2")
  const start = view.state.selection.from
  act(() => {
    engine.setTextCursorPosition("body", "end")
    view.dispatch(
      view.state.tr.setSelection(
        TextSelection.create(view.state.doc, start, view.state.selection.to)
      )
    )
  })
  expect(
    screen.getByRole("combobox", { name: "Paragraph style" })
  ).toHaveTextContent("Mixed styles")
})

it.each(["choose", "same", "escape"])(
  "returns the same selection and typing/Undo target after style %s",
  async (mode) => {
    const { editor, host, view } = setup()
    const user = userEvent.setup()
    expect(host.contains(document.activeElement)).toBe(true)
    const before = view.state.selection.toJSON()
    const trigger = screen.getByRole("combobox", { name: "Paragraph style" })
    trigger.focus()
    await user.keyboard("{ArrowDown}")
    await screen.findByRole("listbox")
    if (mode === "choose") await user.keyboard("{ArrowDown}")
    await user.keyboard(mode === "escape" ? "{Escape}" : "{Enter}")
    await waitFor(() =>
      expect(host.contains(document.activeElement)).toBe(true)
    )
    expect(view.state.selection.toJSON()).toEqual(before)
    act(() => view.dispatch(view.state.tr.insertText("Typed")))
    expect(host).toHaveTextContent("TypedBody text")
    fireEvent.keyDown(document.activeElement!, { key: "z", ctrlKey: true })
    expect(host).not.toHaveTextContent("TypedBody text")
    if (mode === "choose") {
      fireEvent.keyDown(document.activeElement!, { key: "z", ctrlKey: true })
      expect(editor.formattingState()?.paragraphStyle).toBe("normal")
    }
  }
)

it("inserts normalized links at a caret, validates, preserves links when clearing, and restores focus on Apply and Escape", async () => {
  const { editor, host, view, client } = setup()
  fireEvent.keyDown(host, { key: "k", ctrlKey: true })
  expect(await screen.findByRole("dialog", { name: "Add link" })).toBeVisible()
  fireEvent.change(screen.getByLabelText("Text to display"), {
    target: { value: "Portfolio" },
  })
  fireEvent.change(screen.getByLabelText("Link address"), {
    target: { value: "javascript:alert(1)" },
  })
  fireEvent.click(screen.getByRole("button", { name: "Apply" }))
  expect(screen.getByRole("alert")).toHaveTextContent(
    "Enter a website or email address"
  )
  expect(host).not.toHaveTextContent("Portfolio")
  fireEvent.change(screen.getByLabelText("Link address"), {
    target: { value: "example.com/work" },
  })
  fireEvent.click(screen.getByRole("button", { name: "Apply" }))
  await waitFor(() => expect(host.contains(document.activeElement)).toBe(true))
  expect(
    host.querySelector('a[href="https://example.com/work"]')
  ).toHaveTextContent("Portfolio")
  expect(
    host.querySelector('[data-paper-resolved][style*="underline"]')
  ).toBeTruthy()
  act(() =>
    view.dispatch(
      view.state.tr.setSelection(
        TextSelection.create(view.state.doc, view.state.selection.from - 1)
      )
    )
  )
  const selection = view.state.selection.toJSON()
  const linkButton = screen.getByRole("button", { name: "Link" })
  linkButton.focus()
  fireEvent.click(linkButton)
  fireEvent.keyDown(await screen.findByRole("dialog"), { key: "Escape" })
  await waitFor(() => expect(host.contains(document.activeElement)).toBe(true))
  expect(view.state.selection.toJSON()).toEqual(selection)
  act(() => editor.clearFormatting())
  expect(JSON.stringify(client.document())).toContain(
    "https://example.com/work"
  )
  fireEvent.keyDown(host, { key: "k", ctrlKey: true })
  fireEvent.change(await screen.findByLabelText("Link address"), {
    target: { value: "linh@example.com" },
  })
  fireEvent.click(screen.getByRole("button", { name: "Apply" }))
  await waitFor(() => expect(host.contains(document.activeElement)).toBe(true))
  expect(host.querySelector('a[href="mailto:linh@example.com"]')).toBeTruthy()
})

it("does not offer Open for an unsafe stored target and disables the controls when blocked", async () => {
  const { editor, controls } = setup()
  const state = editor.formattingState()
  if (!state) throw new Error("Expected a formatting state")
  vi.spyOn(editor, "formattingState").mockReturnValue({
    ...state,
    href: "javascript:alert(1)",
    linkNeedsText: false,
  })
  controls.rerender(
    <TooltipProvider>
      <RichLinkDialog editor={editor} blocked={false} />
      <RichStructureControls editor={editor} blocked={false}>
        {null}
      </RichStructureControls>
    </TooltipProvider>
  )
  fireEvent.click(screen.getByRole("button", { name: "Link" }))
  expect(await screen.findByRole("dialog", { name: "Edit link" })).toBeVisible()
  expect(screen.queryByRole("link", { name: "Open link" })).toBeNull()
  fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" })
  controls.rerender(
    <TooltipProvider>
      <RichLinkDialog editor={editor} blocked />
      <RichStructureControls editor={editor} blocked>
        {null}
      </RichStructureControls>
    </TooltipProvider>
  )
  for (const button of screen.getAllByRole("button"))
    expect(button).toBeDisabled()
  expect(
    screen.getByRole("combobox", { name: "Paragraph style" })
  ).toBeDisabled()
  fireEvent.keyDown(document.activeElement!, { key: "k", ctrlKey: true })
  expect(screen.queryByRole("dialog")).toBeNull()
})

it("shows custom paragraph ids and disables indentation at the persisted nesting cap", () => {
  const { editor, engine, view, controls } = setup()
  act(() =>
    engine.insertBlocks(
      [
        {
          id: "l1",
          type: "bulletListItem",
          content: "First",
          children: [
            {
              id: "l2",
              type: "bulletListItem",
              content: "Second",
              children: [
                { id: "l3", type: "bulletListItem", content: "Third" },
              ],
            },
          ],
        },
      ],
      "body",
      "after"
    )
  )
  act(() => engine.setTextCursorPosition("l3", "start"))
  expect(editor.formattingState()?.canIndent).toBe(false)
  expect(editor.formattingState()?.canIndent).toBe(false)
  const before = view.state.doc.toJSON()
  act(() => editor.listLevel("in"))
  expect(view.state.doc.toJSON()).toEqual(before)
  act(() => {
    engine.setTextCursorPosition("body", "start")
    const position = view.state.selection.$from.before()
    view.dispatch(
      view.state.tr.setNodeMarkup(position, undefined, {
        ...view.state.selection.$from.parent.attrs,
        paragraphStyle: "custom-career",
      })
    )
  })
  expect(editor.formattingState()?.paragraphStyle).toBe("custom-career")
  controls.rerender(
    <TooltipProvider>
      <RichLinkDialog editor={editor} blocked={false} />
      <RichStructureControls editor={editor} blocked={false}>
        {null}
      </RichStructureControls>
    </TooltipProvider>
  )
  expect(
    screen.getByRole("combobox", { name: "Paragraph style" })
  ).toHaveTextContent("Custom style")
})

it("names only the invalid visible link field", async () => {
  const { host, view } = setup()
  act(() =>
    view.dispatch(
      view.state.tr.setSelection(
        TextSelection.create(
          view.state.doc,
          view.state.selection.from,
          view.state.selection.from + 4
        )
      )
    )
  )
  fireEvent.keyDown(host, { key: "k", ctrlKey: true })
  await screen.findByRole("dialog")
  expect(screen.queryByLabelText("Text to display")).toBeNull()
  fireEvent.change(screen.getByLabelText("Link address"), {
    target: { value: "javascript:alert(1)" },
  })
  fireEvent.click(screen.getByRole("button", { name: "Apply" }))
  expect(screen.getByRole("alert")).toHaveTextContent(
    /^Enter a website or email address\.$/
  )
  expect(screen.getByLabelText("Link address")).toHaveFocus()
  expect(screen.getByLabelText("Link address")).toHaveAttribute(
    "aria-invalid",
    "true"
  )
})

it("describes only the failed field when inserting a link at a caret", async () => {
  const { host } = setup()
  fireEvent.keyDown(host, { key: "k", ctrlKey: true })
  await screen.findByRole("dialog")
  fireEvent.change(screen.getByLabelText("Link address"), {
    target: { value: "example.com" },
  })
  fireEvent.click(screen.getByRole("button", { name: "Apply" }))
  expect(screen.getByLabelText("Text to display")).toHaveFocus()
  expect(screen.getByRole("button", { name: "Apply" })).toHaveAttribute(
    "data-variant",
    "primary"
  )
  expect(screen.getByLabelText("Text to display")).toHaveAccessibleDescription(
    "Enter text to display."
  )
  expect(screen.getByLabelText("Link address")).not.toHaveAttribute(
    "aria-describedby"
  )
  fireEvent.change(screen.getByLabelText("Text to display"), {
    target: { value: "Portfolio" },
  })
  fireEvent.change(screen.getByLabelText("Link address"), {
    target: { value: "javascript:alert(1)" },
  })
  fireEvent.click(screen.getByRole("button", { name: "Apply" }))
  expect(screen.getByLabelText("Link address")).toHaveAccessibleDescription(
    "Enter a website or email address."
  )
  expect(screen.getByLabelText("Text to display")).not.toHaveAttribute(
    "aria-describedby"
  )
})
