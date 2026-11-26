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
import { RichPageSetup } from "./rich-page-setup"
import { RichPageBreak } from "./rich-page-break"

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
  const draw = (blocked = false) => (
    <TooltipProvider>
      <RichPageSetup editor={editor} blocked={blocked}>
        {(open) => (
          <button disabled={blocked} onClick={open}>
            Page setup
          </button>
        )}
      </RichPageSetup>
      <RichPageBreak editor={editor} blocked={blocked} onAction={() => {}} />
    </TooltipProvider>
  )
  const caret = (id: string) =>
    act(() => {
      engine.setTextCursorPosition(id, "start")
      editor.focus()
    })
  const controls = render(draw())
  caret("body")
  disposals.push(() => {
    editor.destroy()
    client.destroy()
    host.remove()
  })
  return { editor, client, host, view, engine, controls, caret, draw }
}

it("swaps Letter and A4 dimensions, refuses a small writing area and returns focus on close", async () => {
  const { editor, host } = setup()
  const user = userEvent.setup()
  await user.click(screen.getByRole("button", { name: "Page setup" }))
  await user.click(screen.getByRole("combobox", { name: "Paper size" }))
  await user.click(await screen.findByRole("option", { name: "A4" }))
  await user.click(screen.getByRole("combobox", { name: "Orientation" }))
  await user.click(await screen.findByRole("option", { name: "Landscape" }))
  await user.click(screen.getByRole("button", { name: "Apply" }))
  expect(editor.pageSetup()).toMatchObject({
    width: 16838,
    height: 11906,
    orientation: "landscape",
  })
  await waitFor(() => expect(host.contains(document.activeElement)).toBe(true))
  await user.click(screen.getByRole("button", { name: "Page setup" }))
  await user.click(screen.getByRole("combobox", { name: "Orientation" }))
  await user.click(await screen.findByRole("option", { name: "Portrait" }))
  await user.click(screen.getByRole("button", { name: "Apply" }))
  expect(editor.pageSetup()).toMatchObject({ width: 11906, height: 16838 })
  await user.click(screen.getByRole("button", { name: "Page setup" }))
  await user.click(screen.getByRole("combobox", { name: "Paper size" }))
  await user.click(await screen.findByRole("option", { name: "Letter" }))
  await user.click(screen.getByRole("combobox", { name: "Orientation" }))
  await user.click(await screen.findByRole("option", { name: "Landscape" }))
  await user.click(screen.getByRole("button", { name: "Apply" }))
  expect(editor.pageSetup()).toMatchObject({ width: 15840, height: 12240 })
  act(() =>
    editor.setPageSetup({ ...editor.pageSetup()!, width: 8640, height: 8640 })
  )
  await user.click(screen.getByRole("button", { name: "Page setup" }))
  for (const label of ["Top", "Bottom"])
    fireEvent.change(screen.getByLabelText(label), { target: { value: "3" } })
  await user.click(screen.getByRole("button", { name: "Apply" }))
  expect(screen.getByRole("alert")).toHaveTextContent("at least 1 inch")
  await user.keyboard("{Escape}")
  await waitFor(() => expect(host.contains(document.activeElement)).toBe(true))
})

it("keeps a custom page size visible and preserves its dimensions when changing orientation", async () => {
  const { editor } = setup()
  act(() =>
    editor.setPageSetup({ ...editor.pageSetup()!, width: 12240, height: 20160 })
  )
  const user = userEvent.setup()
  await user.click(screen.getByRole("button", { name: "Page setup" }))
  expect(
    screen.getByRole("combobox", { name: "Paper size" })
  ).toHaveTextContent("Custom (8.50 × 14.00 in)")
  await user.click(screen.getByRole("combobox", { name: "Orientation" }))
  await user.click(await screen.findByRole("option", { name: "Landscape" }))
  await user.click(screen.getByRole("button", { name: "Apply" }))
  expect(editor.pageSetup()).toMatchObject({ width: 20160, height: 12240 })
})

it("disables controls while blocked and reports an editor becoming unavailable without blaming margins", async () => {
  const { editor, controls, draw } = setup()
  const user = userEvent.setup()
  controls.rerender(draw(true))
  expect(screen.getByRole("button", { name: "Page setup" })).toBeDisabled()
  expect(
    screen.getByRole("button", { name: /Insert page break/ })
  ).toBeDisabled()
  controls.rerender(draw())
  await user.click(screen.getByRole("button", { name: "Page setup" }))
  act(() => editor.setEditable(false))
  await user.click(screen.getByRole("button", { name: "Apply" }))
  expect(screen.getByRole("alert")).toHaveTextContent("Reload the page")
  expect(screen.getByRole("alert")).not.toHaveTextContent("margins")
})

it("releases the editor with a setup dialog open, then safely uses Apply, the break button and Ctrl+Enter", async () => {
  const { editor, view, client, controls, draw } = setup()
  const user = userEvent.setup()
  await user.click(screen.getByRole("button", { name: "Page setup" }))
  act(() => client.destroy())
  expect(editor.pageSetup()).toBeNull()
  expect(editor.canInsertPageBreak()).toBe(false)
  expect(editor.insertPageBreak()).toBe(false)
  expect(editor.removePageBreak(true)).toBe(false)
  await user.click(screen.getByRole("button", { name: "Apply" }))
  expect(screen.getByRole("alert")).toHaveTextContent("Reload the page")
  await user.click(screen.getByRole("button", { name: "Cancel" }))
  await user.click(screen.getByRole("button", { name: /Insert page break/ }))
  await user.click(screen.getByRole("button", { name: "Page setup" }))
  expect(screen.queryByRole("dialog")).toBeNull()
  expect(() =>
    view.dom.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Enter",
        ctrlKey: true,
        bubbles: true,
      })
    )
  ).not.toThrow()
  controls.rerender(draw())
  expect(
    screen.getByRole("button", { name: /Insert page break/ })
  ).toBeDisabled()
})

it("inserts with the button and shortcut but leaves breaks alone while blocked or composing", async () => {
  const { editor, client, view } = setup()
  const user = userEvent.setup()
  await user.click(screen.getByRole("button", { name: /Insert page break/ }))
  const withBreak = client.document()
  expect(
    withBreak?.flow.children[0]?.children.some(
      (node) => node.type === "pageBreak"
    )
  ).toBe(true)
  act(() => editor.setEditable(false))
  expect(editor.removePageBreak(true)).toBe(false)
  fireEvent.keyDown(view.dom, { key: "Backspace" })
  expect(client.document()).toEqual(withBreak)
  act(() => editor.setEditable(true))
  fireEvent.keyDown(view.dom, { key: "Backspace", isComposing: true })
  expect(client.document()).toEqual(withBreak)
  fireEvent.keyDown(view.dom, { key: "Backspace" })
  expect(
    client
      .document()
      ?.flow.children[0]?.children.some((node) => node.type === "pageBreak")
  ).toBe(false)
  fireEvent.keyDown(view.dom, { key: "Enter", ctrlKey: true })
  expect(
    client
      .document()
      ?.flow.children[0]?.children.some((node) => node.type === "pageBreak")
  ).toBe(true)
})

it("refuses a break inside a nested list instead of moving it after the whole list", () => {
  const { editor, engine, client, caret } = setup()
  caret("heading")
  act(() => editor.toggleList("bulletListItem"))
  caret("body")
  act(() => {
    editor.toggleList("bulletListItem")
    editor.listLevel("in")
  })
  act(() => engine.setTextCursorPosition("body", "start"))
  const before = client.document()
  expect(editor.canInsertPageBreak()).toBe(false)
  expect(editor.insertPageBreak()).toBe(false)
  expect(client.document()).toEqual(before)
})

it("keeps fractional imported margins valid when only orientation changes", async () => {
  const { editor } = setup()
  act(() => editor.setPageSetup({ ...editor.pageSetup()!, top: 1134 }))
  const user = userEvent.setup()
  await user.click(screen.getByRole("button", { name: "Page setup" }))
  const top = screen.getByRole("spinbutton", { name: "Top" })
  expect(top).toHaveValue(0.7875)
  expect(top).toBeValid()
  await user.click(screen.getByRole("combobox", { name: "Orientation" }))
  await user.click(await screen.findByRole("option", { name: "Landscape" }))
  await user.click(screen.getByRole("button", { name: "Apply" }))
  await waitFor(() =>
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  )
  expect(editor.pageSetup()).toMatchObject({
    top: 1134,
    orientation: "landscape",
  })
})
