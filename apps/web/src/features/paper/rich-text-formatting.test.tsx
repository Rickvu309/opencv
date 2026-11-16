import { act, cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { mountRichPaperEditor } from "@workspace/paper-crdt/editor"
import { nativeProvenance } from "@workspace/domain"
import { openRichPaperClient } from "../../../../../packages/paper-crdt/src/client.js"
import { seedStoredYDoc } from "../../../../../packages/paper-crdt/src/stored-document.js"
import { storedFlowFixture } from "../../../../../packages/paper-crdt/src/test/flow-fixture.js"
import { shortcutLabel } from "./rich-text-toolbar-control.tsx"
import { RichPaperTextFormatting } from "./rich-text-formatting.tsx"
import { RichPhotoControls } from "./rich-photo-controls.tsx"

const disposals: (() => void)[] = []
let width = 1200
beforeEach(() => {
  width = 1200
  const observer = globalThis.ResizeObserver
  globalThis.ResizeObserver = class implements ResizeObserver {
    constructor(private callback: ResizeObserverCallback) {}
    observe(target: Element) {
      const contentRect = new DOMRect(0, 0, width, 50)
      this.callback(
        [
          {
            target,
            contentRect,
            borderBoxSize: [],
            contentBoxSize: [],
            devicePixelContentBoxSize: [],
          },
        ],
        this
      )
    }
    unobserve() {}
    disconnect() {}
  }
  disposals.push(() => {
    globalThis.ResizeObserver = observer
  })
  vi.stubGlobal("CSS", {
    ...globalThis.CSS,
    escape: (value: string) => value.replaceAll(/[^a-zA-Z0-9_-]/g, ""),
  })
  const fonts = Object.getOwnPropertyDescriptor(document, "fonts")
  Object.defineProperty(document, "fonts", {
    configurable: true,
    value: { ready: Promise.resolve() },
  })
  disposals.push(() => {
    if (fonts) Object.defineProperty(document, "fonts", fonts)
    else Reflect.deleteProperty(document, "fonts")
  })
})
afterEach(() => {
  cleanup()
  for (const dispose of disposals.reverse()) dispose()
  disposals.length = 0
  vi.unstubAllGlobals()
})
function setup(nonText = false, photos = false) {
  const fixture = storedFlowFixture("letter")
  const document = nonText
    ? {
        ...fixture,
        flow: {
          ...fixture.flow,
          children: fixture.flow.children.map((section) => ({
            ...section,
            children: section.children.filter((node) => node.type === "photo"),
          })),
        },
      }
    : fixture
  const provenance = nativeProvenance(document)
  const client = openRichPaperClient(
    {
      epoch: 1,
      revision: 0,
      provenance,
      server: seedStoredYDoc(document),
      pending: Uint8Array.of(0, 0),
    },
    { provenance }
  )
  disposals.push(() => client.destroy())
  const host = globalThis.document.createElement("div")
  globalThis.document.body.append(host)
  disposals.push(() => host.remove())
  const editor = mountRichPaperEditor(client, host)
  disposals.push(() => editor.destroy())
  const rendered = render(
    photos ? (
      <RichPhotoControls editor={editor} disabled={false}>
        {(photoControls) => (
          <RichPaperTextFormatting
            editor={editor}
            blocked={false}
            photoControls={photoControls}
          />
        )}
      </RichPhotoControls>
    ) : (
      <RichPaperTextFormatting editor={editor} blocked={false} />
    )
  )
  return { editor, client, ...rendered }
}
it("renders effective caret values, updates a choice immediately and returns focus at the same caret", async () => {
  const user = userEvent.setup()
  const { editor, client } = setup()
  act(() => editor.focus())
  const content = screen.getByRole("textbox", { name: "Document content" })
  const before = client.document()
  const anchor = getSelection()?.anchorOffset
  expect(screen.getByRole("combobox", { name: "Font" })).toHaveTextContent(
    "Arial"
  )
  expect(screen.getByRole("combobox", { name: "Text size" })).toHaveTextContent(
    "12 pt"
  )
  await user.click(screen.getByRole("combobox", { name: "Text size" }))
  await user.click(screen.getByRole("option", { name: "14 pt", exact: true }))
  await waitFor(() => expect(content).toHaveFocus())
  expect(screen.getByRole("combobox", { name: "Text size" })).toHaveTextContent(
    "14 pt"
  )
  expect(getSelection()?.isCollapsed).toBe(true)
  expect(getSelection()?.anchorOffset).toBe(anchor)
  expect(client.document()).toEqual(before)
  await user.click(
    screen.getByRole("button", { name: "Text color", exact: true })
  )
  await user.click(screen.getByRole("button", { name: "Navy", exact: true }))
  await waitFor(() => expect(content).toHaveFocus())
  expect(
    screen
      .getByRole("button", { name: "Text color", exact: true })
      .querySelector('[data-slot="current-color"]')
  ).toHaveStyle({ backgroundColor: "rgb(30, 58, 138)" })
  expect(editor.activeFormatting()).toMatchObject({
    size: "14",
    color: "#1E3A8A",
  })
  await user.click(
    screen.getByRole("button", { name: "Text color", exact: true })
  )
  await user.click(
    screen.getByRole("button", { name: "Automatic", exact: true })
  )
  await waitFor(() => expect(content).toHaveFocus())
  expect(editor.activeFormatting()?.color).toBe("#000000")
})
it("puts the remaining groups in a visible More control and returns focus after an overflow choice", async () => {
  width = 390
  const user = userEvent.setup()
  const { editor } = setup()
  expect(
    screen.getByRole("button", { name: "More formatting" })
  ).toHaveTextContent("More")
  for (const name of ["Bold", "Italic", "Underline"])
    expect(screen.getByRole("button", { name, exact: true })).toBeVisible()
  expect(
    screen.queryByRole("button", { name: "Strikethrough", exact: true })
  ).not.toBeInTheDocument()
  expect(
    screen.queryByRole("button", { name: "Text color", exact: true })
  ).not.toBeInTheDocument()
  await user.click(screen.getByRole("button", { name: "More formatting" }))
  expect(
    screen.getByRole("group", { name: "Paragraph formatting" })
  ).toBeVisible()
  await user.click(screen.getByRole("combobox", { name: "Line spacing" }))
  await user.click(screen.getByRole("option", { name: "Double", exact: true }))
  await waitFor(() =>
    expect(
      screen.getByRole("textbox", { name: "Document content" })
    ).toHaveFocus()
  )
  expect(editor.activeFormatting()?.lineSpacing).toBe("2")
  expect(
    screen.queryByRole("group", { name: "Paragraph formatting" })
  ).not.toBeInTheDocument()
})
it("disables controls without showing Mixed while loading or blocked", () => {
  width = 390
  const { rerender } = render(
    <RichPaperTextFormatting editor={null} blocked={false} />
  )
  for (const name of ["Bold", "Italic", "Underline"])
    expect(screen.getByRole("button", { name, exact: true })).toBeDisabled()
  expect(screen.queryByText("Mixed")).not.toBeInTheDocument()
  expect(screen.getByRole("button", { name: "More formatting" })).toBeDisabled()
  rerender(<RichPaperTextFormatting editor={null} blocked />)
  expect(screen.queryByText("Mixed")).not.toBeInTheDocument()
})

it("disables controls for a document containing only a non-text object", () => {
  const { editor } = setup(true)
  expect(editor.activeFormatting()?.hasText).toBe(false)
  for (const name of ["Bold", "Italic", "Underline"])
    expect(screen.getByRole("button", { name, exact: true })).toBeDisabled()
  expect(screen.queryByText("Mixed")).not.toBeInTheDocument()
})

it("shows shortcuts for the current platform", () => {
  expect(shortcutLabel("Ctrl+B", "MacIntel")).toBe("⌘+B")
  expect(shortcutLabel("Ctrl+Shift+L/E/R/J", "MacIntel")).toBe(
    "⌘+Shift+L/E/R/J"
  )
  expect(shortcutLabel("Ctrl+]", "Linux x86_64")).toBe("Ctrl+]")
})

it("keeps photo icons in the single desktop formatting toolbar", () => {
  setup(false, true)
  const toolbar = screen.getByRole("toolbar", { name: "Text formatting" })
  expect(screen.getAllByRole("toolbar")).toHaveLength(1)
  const insert = screen.getByRole("button", {
    name: "Insert photo",
    exact: true,
  })
  expect(toolbar).toContainElement(insert)
  expect(insert.closest("fieldset")).toHaveAccessibleName("Photos")
  expect(insert).toBeEnabled()
  expect(
    screen.queryByRole("button", { name: "More formatting" })
  ).not.toBeInTheDocument()
})
it("keeps photo editing available in More on a phone with no text selection", async () => {
  width = 390
  const user = userEvent.setup()
  setup(true, true)
  expect(
    screen.queryByRole("button", { name: "Insert photo", exact: true })
  ).not.toBeInTheDocument()
  const more = screen.getByRole("button", { name: "More formatting" })
  expect(more).toBeEnabled()
  await user.click(more)
  expect(
    screen.getByRole("button", { name: "Insert photo", exact: true })
  ).toBeEnabled()
  await user.click(
    screen.getByRole("button", { name: "Edit photo", exact: true })
  )
  expect(screen.getByRole("dialog", { name: "Edit photo" })).toBeVisible()
  await user.keyboard("{Escape}")
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
})
