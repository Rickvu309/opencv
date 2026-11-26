import { act, cleanup, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { mountRichPaperEditor } from "@workspace/paper-crdt/editor"
import { nativeProvenance } from "@workspace/domain/paper-doc"
import { openRichPaperClient } from "../../../../../../packages/paper-crdt/src/client.js"
import { seedStoredYDoc } from "../../../../../../packages/paper-crdt/src/stored-document.js"
import { storedFlowFixture } from "../../../../../../packages/paper-crdt/src/test/flow-fixture.js"
import { RichPaperTextFormatting } from "./rich-text-formatting.tsx"

const disposals: (() => void)[] = []
let width = 1200
beforeEach(() => {
  width = 1200
  Object.defineProperties(Range.prototype, {
    getClientRects: { configurable: true, value: () => [] },
    getBoundingClientRect: { configurable: true, value: () => new DOMRect() },
  })
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
    const input = within(dialog).getByRole("textbox", { name })
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
    within(dialog).getByRole("textbox", { name: "Text size (pt)" })
  ).toHaveAttribute("placeholder", "Mixed")
  expect(
    within(dialog).getByRole("textbox", { name: "Text size (pt)" })
  ).toHaveValue("")
  await user.click(within(dialog).getByRole("button", { name: "Apply" }))
  expect(client.document()).toEqual(before)
})

async function fillNumber(
  user: ReturnType<typeof userEvent.setup>,
  name: string,
  value: string
) {
  const input = screen.getByRole("textbox", { name })
  await user.clear(input)
  await user.type(input, value)
}

it("keeps the dialog's caret size while closing, focusing and typing", async () => {
  width = 2000
  const user = userEvent.setup()
  const { editor } = setup()
  act(() => editor.focus())
  await user.click(screen.getByRole("button", { name: "Size and spacing" }))
  await fillNumber(user, "Text size (pt)", "10.5")
  await user.click(screen.getByRole("button", { name: "Apply" }))
  expect(editor.activeFormatting()?.size).toBe("10.5")
  const content = screen.getByRole("textbox", { name: "Document content" })
  expect(content).toHaveFocus()
  await user.type(content, "Caret", { skipClick: true })
  expect(editor.activeFormatting()?.size).toBe("10.5")
  expect(content).toHaveTextContent("Caret")
})

it.each([
  "Text size (pt)",
  "Space before (pt)",
  "Space after (pt)",
  "Line spacing (lines)",
])(
  "allows changing only %s with existing canonical precision in every field",
  async (name) => {
    width = 2000
    const user = userEvent.setup()
    const { editor } = setup()
    act(() => {
      const start = editor.captureSelection()!.plain.anchor
      editor.restoreSelection({
        plain: { anchor: start, head: start + 4 },
        focused: true,
      })
      editor.formatTypography({
        size: 210,
        before: 123,
        after: 87,
        lineSpacing: { kind: "multiple", value: 1.125 },
      })
    })
    await user.click(screen.getByRole("button", { name: "Size and spacing" }))
    await fillNumber(
      user,
      name,
      name === "Text size (pt)"
        ? "11.5"
        : name === "Line spacing (lines)"
          ? "2.05"
          : "6.25"
    )
    await user.click(screen.getByRole("button", { name: "Apply" }))
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(editor.activeFormatting()).toMatchObject({
      size: name === "Text size (pt)" ? "11.5" : "10.5",
      before: name === "Space before (pt)" ? "6.25" : "6.15",
      after: name === "Space after (pt)" ? "6.25" : "4.35",
      lineValue: name === "Line spacing (lines)" ? "2.05" : "1.125",
    })
  }
)

it.each(["2.05", "4.15", "1.125"])(
  "stores the exact custom line multiple %s",
  async (value) => {
    width = 2000
    const user = userEvent.setup()
    const { editor, client } = setup()
    await user.click(screen.getByRole("button", { name: "Size and spacing" }))
    await fillNumber(user, "Line spacing (lines)", value)
    await user.click(screen.getByRole("button", { name: "Apply" }))
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(editor.activeFormatting()?.lineValue).toBe(value)
    expect(JSON.stringify(client.document())).toContain(
      `"lineSpacing":{"kind":"multiple","value":${value}}`
    )
  }
)

it("explains an unrepresentable multiple before changing the document", async () => {
  width = 2000
  const user = userEvent.setup()
  const { client } = setup()
  const before = client.document()
  await user.click(screen.getByRole("button", { name: "Size and spacing" }))
  await fillNumber(user, "Line spacing (lines)", "1.001")
  await user.click(screen.getByRole("button", { name: "Apply" }))
  expect(screen.getByRole("alert")).toHaveTextContent("exact Word units")
  expect(client.document()).toEqual(before)
})

it("types and steps the toolbar size and retains the font and color pickers' typing marks", async () => {
  width = 2000
  const user = userEvent.setup()
  const { editor, client } = setup()
  act(() => editor.focus())
  await fillNumber(user, "Font size (pt)", "10.5")
  await user.keyboard("{Enter}")
  expect(editor.activeFormatting()?.size).toBe("10.5")
  await user.click(screen.getByRole("button", { name: "Increase font size" }))
  expect(editor.activeFormatting()?.size).toBe("11")
  await user.click(screen.getByRole("button", { name: "Decrease font size" }))
  expect(editor.activeFormatting()?.size).toBe("10.5")
  await user.click(screen.getByRole("combobox", { name: "Font" }))
  await user.click(screen.getByRole("option", { name: "Courier New" }))
  await user.click(screen.getByRole("button", { name: "Text color" }))
  await user.click(screen.getByRole("button", { name: "Navy" }))
  const content = screen.getByRole("textbox", { name: "Document content" })
  act(() => editor.focus())
  await user.type(content, "Styled", { skipClick: true })
  expect(content).toHaveTextContent("Styled")
  const inserted = JSON.stringify(client.document())
  expect(inserted).toMatch(/\{[^{}]*"text":"Styled"[^{}]*\}/)
  const run = JSON.parse(
    /\{[^{}]*"text":"Styled"[^{}]*\}/.exec(inserted)![0]
  ) as Record<string, unknown>
  expect(run).toMatchObject({
    size: 210,
    fontId: "liberation-mono",
    color: "#1E3A8A",
  })
})

function sizesOf(client: ReturnType<typeof setup>["client"]) {
  return [...JSON.stringify(client.document()).matchAll(/"size":(\d+)/g)].map(
    (match) => Number(match[1])
  )
}

it("steps each run of a mixed selection from its own size in one Undo", async () => {
  width = 2000
  const user = userEvent.setup()
  const { editor, client } = setup()
  const start = editor.captureSelection()!.plain.anchor
  const select = (from: number, length: number) =>
    editor.restoreSelection({
      plain: { anchor: start + from, head: start + from + length },
      focused: true,
    })
  act(() => {
    select(0, 4)
    editor.formatInline({ size: 200 })
    select(4, 4)
    editor.formatInline({ size: 480 })
    select(8, 3)
    editor.formatInline({ size: 200 })
    select(0, 11)
  })
  const before = client.document()
  expect(sizesOf(client)).toEqual(expect.arrayContaining([200, 480]))
  expect(screen.getByRole("textbox", { name: "Font size (pt)" })).toHaveValue(
    ""
  )
  await user.click(screen.getByRole("button", { name: "Increase font size" }))
  expect(sizesOf(client)).toEqual(expect.arrayContaining([210, 490]))
  expect(sizesOf(client)).not.toContain(230)
  expect(sizesOf(client)).not.toContain(200)
  await user.click(screen.getByRole("button", { name: "Decrease font size" }))
  await user.click(screen.getByRole("button", { name: "Decrease font size" }))
  expect(sizesOf(client)).toEqual(expect.arrayContaining([190, 470]))
  act(() => editor.undo())
  act(() => editor.undo())
  act(() => editor.undo())
  expect(client.document()).toEqual(before)
})

it.each([
  ["10,5", "10.5"],
  ["10.5", "10.5"],
])(
  "reads %s in the toolbar size box as a decimal, never as thousands",
  async (typed, size) => {
    width = 2000
    const user = userEvent.setup()
    const { editor } = setup()
    act(() => editor.focus())
    await fillNumber(user, "Font size (pt)", typed)
    await user.keyboard("{Enter}")
    expect(editor.activeFormatting()?.size).toBe(size)
  }
)

it("refuses an unreadable toolbar size with a message and keeps the document", async () => {
  width = 2000
  const user = userEvent.setup()
  const { editor, client } = setup()
  act(() => editor.focus())
  const before = client.document()
  await fillNumber(user, "Font size (pt)", "10,25")
  await user.keyboard("{Enter}")
  const input = screen.getByRole("textbox", { name: "Font size (pt)" })
  expect(input).toBeInvalid()
  expect((input as HTMLInputElement).validationMessage).toMatch(/half points/)
  expect(client.document()).toEqual(before)
})

it("reads decimal commas in the dialog as decimals", async () => {
  width = 2000
  const user = userEvent.setup()
  const { editor } = setup()
  act(() => editor.focus())
  await user.click(screen.getByRole("button", { name: "Size and spacing" }))
  await fillNumber(user, "Text size (pt)", "10,5")
  await fillNumber(user, "Space before (pt)", "6,15")
  await fillNumber(user, "Line spacing (lines)", "2,05")
  await user.click(screen.getByRole("button", { name: "Apply" }))
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  expect(editor.activeFormatting()).toMatchObject({
    size: "10.5",
    before: "6.15",
    lineValue: "2.05",
  })
})

it("closes More after a size is applied from it on a phone", async () => {
  width = 390
  const user = userEvent.setup()
  const { editor } = setup()
  act(() => editor.focus())
  await user.click(screen.getByRole("button", { name: "More formatting" }))
  const more = screen.getByRole("dialog", { name: "More formatting" })
  const input = within(more).getByRole("textbox", { name: "Font size (pt)" })
  await user.clear(input)
  await user.type(input, "13{Enter}")
  expect(editor.activeFormatting()?.size).toBe("13")
  expect(
    screen.queryByRole("dialog", { name: "More formatting" })
  ).not.toBeInTheDocument()
  await user.click(screen.getByRole("button", { name: "More formatting" }))
  await user.click(
    within(screen.getByRole("dialog", { name: "More formatting" })).getByRole(
      "button",
      { name: "Increase font size" }
    )
  )
  expect(editor.activeFormatting()?.size).toBe("13.5")
  expect(
    screen.queryByRole("dialog", { name: "More formatting" })
  ).not.toBeInTheDocument()
})
