import { act, cleanup, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { mountRichPaperEditor } from "@workspace/paper-crdt/editor"
import { nativeProvenance } from "@workspace/domain"
import { openRichPaperClient } from "../../../../../packages/paper-crdt/src/client.js"
import { seedStoredYDoc } from "../../../../../packages/paper-crdt/src/stored-document.js"
import { storedFlowFixture } from "../../../../../packages/paper-crdt/src/test/flow-fixture.js"
import { RichPaperTextFormatting } from "./rich-text-formatting.tsx"

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
    function () {
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
function setup() {
  const document = storedFlowFixture("letter")
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
  render(<RichPaperTextFormatting editor={editor} blocked={false} />)
  return { editor, client }
}
it("applies exact size and spacing, restores them with Undo/Redo, and clears every override", async () => {
  width = 2000
  const user = userEvent.setup()
  const { editor, client } = setup()
  const start = editor.captureSelection()!.plain.anchor
  act(() =>
    editor.restoreSelection({
      plain: { anchor: start, head: start + 11 },
      focused: true,
    })
  )
  const before = client.document()
  await user.click(screen.getByRole("button", { name: "Size and spacing" }))
  const dialog = screen.getByRole("dialog", { name: "Size and spacing" })
  for (const [name, value] of [
    ["Text size (pt)", "10.5"],
    ["Space before (pt)", "6.25"],
    ["Space after (pt)", "4.25"],
    ["Line spacing (lines)", "1.25"],
  ]) {
    const input = within(dialog).getByRole("spinbutton", { name })
    await user.clear(input)
    await user.type(input, value!)
  }
  await user.click(within(dialog).getByRole("button", { name: "Apply" }))
  expect(
    screen.queryByRole("dialog", { name: "Size and spacing" })
  ).not.toBeInTheDocument()
  expect(editor.activeFormatting()).toMatchObject({
    size: "10.5",
    before: "6.25",
    after: "4.25",
    lineValue: "1.25",
  })
  const after = client.document()
  act(() => editor.undo())
  expect(client.document()).toEqual(before)
  act(() => editor.redo())
  expect(client.document()).toEqual(after)
  act(() => editor.clearFormatting())
  expect(editor.activeFormatting()).toMatchObject({
    size: "11",
    before: "0",
    after: "0",
    lineValue: "1.2",
  })
})

it("shows mixed exact fields and leaves untouched values unchanged", async () => {
  width = 2000
  const user = userEvent.setup()
  const { editor, client } = setup()
  const start = editor.captureSelection()!.plain.anchor
  act(() => {
    editor.restoreSelection({
      plain: { anchor: start, head: start + 4 },
      focused: true,
    })
    editor.formatTypography({ size: 210, before: 125, after: 85 })
    editor.restoreSelection({
      plain: { anchor: start, head: start + 11 },
      focused: true,
    })
  })
  const before = client.document()
  await user.click(screen.getByRole("button", { name: "Size and spacing" }))
  const dialog = screen.getByRole("dialog", { name: "Size and spacing" })
  expect(
    within(dialog).getByRole("spinbutton", { name: "Text size (pt)" })
  ).toHaveAttribute("placeholder", "Mixed")
  expect(
    within(dialog).getByRole("spinbutton", { name: "Text size (pt)" })
  ).toHaveValue(null)
  await user.click(within(dialog).getByRole("button", { name: "Apply" }))
  expect(client.document()).toEqual(before)
})
