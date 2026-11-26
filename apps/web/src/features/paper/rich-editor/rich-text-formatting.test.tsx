import {
  act,
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { mountRichPaperEditor } from "@workspace/paper-crdt/editor"
import { nativeProvenance } from "@workspace/domain/paper-doc"
import { openRichPaperClient } from "../../../../../../packages/paper-crdt/src/client.js"
import { seedStoredYDoc } from "../../../../../../packages/paper-crdt/src/stored-document.js"
import { storedFlowFixture } from "../../../../../../packages/paper-crdt/src/test/flow-fixture.js"
import { shortcutLabel } from "./rich-text-toolbar-control.tsx"
import { RichPaperTextFormatting } from "./rich-text-formatting.tsx"
import { RichPhotoControls } from "./rich-photo-controls.tsx"
import { RichLinkDialog } from "./rich-structure-controls.tsx"

const disposals: (() => void)[] = []
let width = 1200
beforeEach(() => {
  width = 1200
  const computedStyle = window.getComputedStyle.bind(window)
  vi.spyOn(window, "getComputedStyle").mockImplementation((element) => {
    const style = computedStyle(element)
    if (
      element.getAttribute("role") === "toolbar" ||
      element.hasAttribute("data-toolbar-more")
    )
      return new Proxy(style, {
        get(target, property) {
          if (property === "columnGap") return "4px"
          if (
            property === "paddingInlineStart" ||
            property === "paddingInlineEnd"
          )
            return "12px"
          return Reflect.get(target, property)
        },
      })
    return style
  })
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
    function (this: Element) {
      const label = this.getAttribute("data-toolbar-item")
      const phone = width < 768
      if (this.tagName.toLowerCase() === "svg") return new DOMRect(0, 0, 16, 16)
      if (label)
        return new DOMRect(
          0,
          0,
          label === "Font"
            ? 176
            : label === "Text size"
              ? 80
              : label === "Line spacing" ||
                  label === "Special indent" ||
                  label.startsWith("Alignment")
                ? 56
                : label === "Paragraph style"
                  ? 144
                  : phone
                    ? 44
                    : 32,
          phone ? 44 : 32
        )
      if (this.hasAttribute("data-toolbar-more-label"))
        return new DOMRect(0, 0, 32, 20)
      if (this.hasAttribute("data-toolbar-more"))
        return new DOMRect(0, 0, 76, phone ? 44 : 32)
      if (this.hasAttribute("data-toolbar-pinned"))
        return new DOMRect(
          0,
          0,
          this.getAttribute("role") === "separator" ? 1 : phone ? 92 : 68,
          44
        )
      if (this.getAttribute("role") === "toolbar")
        return new DOMRect(0, 0, width, 60)
      return new DOMRect()
    }
  )
  disposals.push(() => vi.restoreAllMocks())
  const observer = globalThis.ResizeObserver
  globalThis.ResizeObserver = class implements ResizeObserver {
    private callback: ResizeObserverCallback
    constructor(callback: ResizeObserverCallback) {
      this.callback = callback
    }
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
    <>
      {photos ? (
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
      )}
      <RichLinkDialog editor={editor} blocked={false} />
    </>
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
  await user.click(screen.getByRole("option", { name: "14 pt" }))
  await waitFor(() => expect(content).toHaveFocus())
  expect(screen.getByRole("combobox", { name: "Text size" })).toHaveTextContent(
    "14 pt"
  )
  expect(getSelection()?.isCollapsed).toBe(true)
  expect(getSelection()?.anchorOffset).toBe(anchor)
  expect(client.document()).toEqual(before)
  await user.click(screen.getByRole("button", { name: "Text color" }))
  await user.click(screen.getByRole("button", { name: "Navy" }))
  await waitFor(() => expect(content).toHaveFocus())
  expect(
    screen
      .getByRole("button", { name: "Text color" })
      .querySelector('[data-slot="current-color"]')
  ).toHaveStyle({ backgroundColor: "rgb(30, 58, 138)" })
  expect(editor.activeFormatting()).toMatchObject({
    size: "14",
    color: "#1E3A8A",
  })
  await user.click(screen.getByRole("button", { name: "Text color" }))
  await user.click(screen.getByRole("button", { name: "Automatic" }))
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
    expect(screen.getByRole("button", { name })).toBeVisible()
  expect(
    screen.queryByRole("button", { name: "Strikethrough" })
  ).not.toBeInTheDocument()
  expect(
    screen.queryByRole("button", { name: "Text color" })
  ).not.toBeInTheDocument()
  await user.click(screen.getByRole("button", { name: "More formatting" }))
  expect(
    screen.getByRole("group", { name: "Paragraph formatting" })
  ).toBeVisible()
  await user.click(screen.getByRole("combobox", { name: "Line spacing" }))
  await user.click(screen.getByRole("option", { name: "Double" }))
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
    expect(screen.getByRole("button", { name })).toBeDisabled()
  expect(screen.queryByText("Mixed")).not.toBeInTheDocument()
  expect(screen.getByRole("button", { name: "More formatting" })).toBeDisabled()
  rerender(<RichPaperTextFormatting editor={null} blocked />)
  expect(screen.queryByText("Mixed")).not.toBeInTheDocument()
})

it("disables controls for a document containing only a non-text object", () => {
  const { editor } = setup(true)
  expect(editor.activeFormatting()?.hasText).toBe(false)
  for (const name of ["Bold", "Italic", "Underline"])
    expect(screen.getByRole("button", { name })).toBeDisabled()
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
  const insert = screen.getByRole("button", { name: "Insert photo" })
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
    screen.queryByRole("button", { name: "Insert photo" })
  ).not.toBeInTheDocument()
  const more = screen.getByRole("button", { name: "More formatting" })
  expect(more).toBeEnabled()
  await user.click(more)
  expect(screen.getByRole("button", { name: "Insert photo" })).toBeEnabled()
  await user.click(screen.getByRole("button", { name: "Edit photo" }))
  expect(screen.getByRole("dialog", { name: "Edit photo" })).toBeVisible()
  await user.keyboard("{Escape}")
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
})

it.each([1440, 390])(
  "keeps one document history pair first and visible at %i",
  async (viewport) => {
    width = viewport
    const user = userEvent.setup()
    const { editor, client } = setup(false, true)
    const toolbar = screen.getByRole("toolbar", { name: "Text formatting" })
    const undo = within(toolbar).getAllByRole("button", {
      name: /^Undo \(.*Z\)$/,
    })
    const redo = within(toolbar).getAllByRole("button", {
      name: /^Redo \(.*Shift\+Z\)$/,
    })
    expect(undo).toHaveLength(1)
    expect(redo).toHaveLength(1)
    expect(undo[0]).toBeVisible()
    expect(redo[0]).toBeVisible()
    expect(within(toolbar).getAllByRole("button").slice(0, 2)).toEqual([
      undo[0],
      redo[0],
    ])
    expect(undo[0]?.closest("fieldset")).toHaveAccessibleName(
      "Document history"
    )
    act(() => editor.focus())
    const content = screen.getByRole("textbox", { name: "Document content" })
    const inline = content.querySelector(".bn-inline-content")
    if (!inline) throw new Error("Text paragraph missing")
    act(() => {
      const range = document.createRange()
      range.selectNodeContents(inline)
      const selection = getSelection()
      selection?.removeAllRanges()
      selection?.addRange(range)
      document.dispatchEvent(new Event("selectionchange"))
    })
    const before = client.document()
    act(() => editor.formatParagraph({ alignment: "center" }))
    const textEdit = client.document()
    expect(textEdit).not.toEqual(before)
    if (!undo[0] || !redo[0]) throw new Error("History buttons missing")
    await user.click(undo[0])
    expect(client.document()).toEqual(before)
    await user.click(redo[0])
    expect(client.document()).toEqual(textEdit)
    act(() =>
      editor.insertPhoto(
        "file:00000000-0000-4000-8000-000000000002",
        2687 / 3356
      )
    )
    const photoEdit = client.document()
    expect(photoEdit).not.toEqual(textEdit)
    await user.click(undo[0])
    expect(client.document()).toEqual(textEdit)
    await user.click(redo[0])
    expect(client.document()).toEqual(photoEdit)
    if (viewport === 390) {
      await user.click(screen.getByRole("button", { name: "More formatting" }))
      expect(screen.getAllByRole("button", { name: /^Undo / })).toHaveLength(1)
      expect(screen.getAllByRole("button", { name: /^Redo / })).toHaveLength(1)
      expect(
        screen.getByRole("dialog", { name: "More formatting" })
      ).not.toContainElement(undo[0])
      expect(
        screen
          .getByRole("dialog", { name: "More formatting" })
          .querySelector('[role="separator"]')
      ).toBeNull()
    }
  }
)

it("disables empty phone overflow while preserving document history", () => {
  width = 390
  const { editor } = setup(true)
  expect(screen.getByRole("button", { name: "More formatting" })).toBeDisabled()
  act(() => editor.insertPhoto("file:00000000-0000-4000-8000-000000000002", 1))
  expect(screen.getByRole("button", { name: /^Undo / })).toBeEnabled()
})

it.each([390, 768, 820, 859])(
  "puts structure controls in More at %s pixels",
  async (viewport) => {
    width = viewport
    const user = userEvent.setup()
    setup()
    expect(
      screen.queryByRole("combobox", { name: "Paragraph style" })
    ).toBeNull()
    expect(screen.queryByRole("button", { name: "Link" })).toBeNull()
    expect(screen.queryByRole("button", { name: "Undo" })).toBeNull()
    expect(screen.queryByRole("button", { name: "Redo" })).toBeNull()
    await user.click(screen.getByRole("button", { name: "More formatting" }))
    expect(
      screen.getByRole("combobox", { name: "Paragraph style" })
    ).toBeVisible()
    for (const name of [
      "Link",
      "Bulleted list",
      "Numbered list",
      "Remove formatting",
    ])
      expect(screen.getByRole("button", { name })).toBeVisible()
    expect(
      screen.getAllByRole("button", { name: /Increase indent/ })
    ).toHaveLength(1)
    expect(
      screen.getAllByRole("button", { name: /Decrease indent/ })
    ).toHaveLength(1)
    await user.click(screen.getByRole("button", { name: "Link" }))
    expect(
      await screen.findByRole("dialog", { name: "Add link" })
    ).toBeVisible()
    await user.keyboard("{Escape}")
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Add link" })).toBeNull()
    )
  }
)

it("uses one indent pair for list levels and paragraph indentation", async () => {
  const user = userEvent.setup()
  const { editor, client } = setup()
  act(() => editor.focus())
  await user.click(screen.getByRole("button", { name: /Increase indent/ }))
  expect(editor.activeFormatting()?.start).toBe("0.25")
  act(() => editor.toggleList("bulletListItem"))
  const before = client.document()
  await user.click(screen.getByRole("button", { name: /Increase indent/ }))
  expect(editor.activeFormatting()?.start).toBe("0.25")
  expect(
    screen.getAllByRole("button", { name: /Increase indent/ })
  ).toHaveLength(1)
  expect(
    screen.getAllByRole("button", { name: /Decrease indent/ })
  ).toHaveLength(1)
  expect(client.document()).toEqual(before)
})

it("uses main's inline controls and More contents before width is known", async () => {
  width = 0
  const user = userEvent.setup()
  setup(false, true)
  const toolbar = screen.getByRole("toolbar", { name: "Text formatting" })
  expect(
    within(toolbar)
      .getAllByRole("button")
      .map((button) => button.getAttribute("aria-label"))
  ).toEqual([
    shortcutLabel("Undo (Ctrl+Z)"),
    shortcutLabel("Redo (Ctrl+Shift+Z)"),
    "Bold",
    "Italic",
    "Underline",
    "More formatting",
  ])
  expect(within(toolbar).queryByRole("combobox")).toBeNull()
  await user.click(screen.getByRole("button", { name: "More formatting" }))
  const menu = screen.getByRole("dialog", { name: "More formatting" })
  expect(
    within(menu).getByRole("combobox", { name: "Paragraph style" })
  ).toBeVisible()
  expect(within(menu).getByRole("combobox", { name: "Font" })).toBeVisible()
  expect(
    within(menu).getByRole("combobox", { name: "Text size" })
  ).toBeVisible()
  for (const name of [
    "Strikethrough",
    "Text color",
    "Highlight",
    "Insert photo",
    "Link",
    "Bulleted list",
    "Numbered list",
    "Remove formatting",
  ])
    expect(within(menu).getByRole("button", { name })).toBeVisible()
  for (const name of ["Bold", "Italic", "Underline"])
    expect(within(menu).queryByRole("button", { name })).toBeNull()
})

it("restores main's fallback and measures again when the editor returns", () => {
  width = 390
  const { editor, rerender } = setup()
  expect(screen.getByRole("button", { name: "More formatting" })).toBeVisible()
  width = 0
  rerender(<RichPaperTextFormatting editor={null} blocked={false} />)
  for (const name of ["Bold", "Italic", "Underline", "More formatting"])
    expect(screen.getByRole("button", { name })).toBeVisible()
  expect(screen.queryByRole("button", { name: "Link" })).toBeNull()
  expect(screen.queryByRole("combobox", { name: "Font" })).toBeNull()
  width = 240
  rerender(<RichPaperTextFormatting editor={editor} blocked={false} />)
  expect(screen.getByRole("button", { name: "More formatting" })).toBeVisible()
  expect(screen.queryByRole("button", { name: "Underline" })).toBeNull()
})

it("closes More when widening and keeps empty groups out of its accessible contents", async () => {
  width = 859
  const user = userEvent.setup()
  const { editor, rerender } = setup()
  await user.click(screen.getByRole("button", { name: "More formatting" }))
  const menu = screen.getByRole("dialog", { name: "More formatting" })
  for (const group of within(menu).queryAllByRole("group"))
    expect(
      within(group).queryAllByRole("button").length +
        within(group).queryAllByRole("combobox").length
    ).toBeGreaterThan(0)
  width = 1440
  rerender(<RichPaperTextFormatting editor={null} blocked={false} />)
  await waitFor(() =>
    expect(screen.queryByRole("dialog", { name: "More formatting" })).toBeNull()
  )
  width = 859
  rerender(<RichPaperTextFormatting editor={editor} blocked={false} />)
  expect(
    screen.getByRole("button", { name: "More formatting" })
  ).toHaveAttribute("aria-expanded", "false")
  expect(screen.queryByRole("dialog", { name: "More formatting" })).toBeNull()
})
