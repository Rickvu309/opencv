import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { act, fireEvent, screen, waitFor } from "@testing-library/react"
import * as Y from "yjs"
import userEvent from "@testing-library/user-event"
import { uploadPaperPhoto } from "../paper-api.ts"
import { parseFileId, parsePaperId } from "@workspace/domain/kernel"
import {
  nativeProvenance,
  RICH_NATIVE_WRITER,
} from "@workspace/domain/paper-doc"
import {
  emptyUpdate,
  openRichPaperClient,
  seedStoredYDoc,
} from "@workspace/paper-crdt"
import { mountRichPaperEditor } from "@workspace/paper-crdt/editor"
import { openRichPaperSession } from "@/lib/paper-rich.ts"
import { render } from "@/test/render-with-client.tsx"
import { storedFlowFixture } from "../../../../../../packages/paper-crdt/src/test/flow-fixture.ts"
import { RichTableControls } from "./rich-table-controls.tsx"
import { RichPaperPage } from "./rich-page.tsx"
import * as flowMount from "../../../../../../packages/paper-crdt/src/native-layout-flow-mount.ts"

vi.mock("@/lib/paper-rich.ts", () => ({ openRichPaperSession: vi.fn() }))

vi.mock("../paper-api.ts", () => ({ uploadPaperPhoto: vi.fn() }))

vi.mock("@/features/coach/use-chat-store.ts", () => ({
  useChatStore: () => ({ openChat: vi.fn() }),
}))

const cleanups = new Set<() => void>()
let mounted: ReturnType<typeof flowMount.mountPrivateFlow>
beforeEach(() => {
  const mount = flowMount.mountPrivateFlow
  vi.spyOn(flowMount, "mountPrivateFlow").mockImplementation((...args) => {
    mounted = mount(...args)
    return mounted
  })
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
  for (const cleanup of cleanups) cleanup()
  cleanups.clear()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

function paste(host: HTMLElement, words: string) {
  const event = new Event("paste", { bubbles: true, cancelable: true })
  Object.defineProperty(event, "clipboardData", {
    value: {
      getData: (name: string) => (name === "text/plain" ? words : ""),
      types: ["text/plain"],
      files: [],
    },
  })
  fireEvent(host, event)
}

it.each([
  ["cv", "accepted epoch reset"],
  ["letter", "accepted epoch reset"],
  ["cv", "refused pending epoch reset"],
  ["letter", "refused pending epoch reset"],
  ["cv", "fresh-history epoch reset"],
  ["letter", "fresh-history epoch reset"],
] as const)(
  "keeps the %s page usable after a %s",
  async (kind, mode) => {
    const initial = storedFlowFixture(kind)
    const provenance = nativeProvenance(initial)
    const remote = new Y.Doc()
    Y.applyUpdate(remote, seedStoredYDoc(initial))
    const client = openRichPaperClient(
      {
        epoch: 1,
        revision: 0,
        provenance,
        server: Y.encodeStateAsUpdate(remote),
        pending: emptyUpdate(),
      },
      { provenance }
    )
    cleanups.add(() => {
      client.destroy()
      remote.destroy()
    })
    const downloadWord = vi.fn(async () => {})
    vi.mocked(openRichPaperSession).mockReturnValue({
      initialized: Promise.resolve(),
      status: () => "saved",
      ready: () => true,
      client: () => client,
      subscribe: () => () => {},
      flush: async () => {},
      persist: async () => {},
      captureSaved: vi.fn(),
      downloadWord,
      destroy: async () => {
        client.destroy()
      },
    })
    const page = (key: string) => (
      <RichPaperPage
        key={key}
        name={`My ${kind}`}
        identity={{
          kind: "native",
          ownerId: "lifecycle",
          sessionId: "lifecycle",
          docId: parsePaperId("15900000-0000-4000-8000-000000000001"),
          provenance,
          writer: RICH_NATIVE_WRITER,
        }}
        editedAt="2026-11-27T00:00:00.000Z"
        onBack={() => {}}
        onOpen={() => {}}
      />
    )
    const view = render(page("initial"))
    const host = await screen.findByLabelText("Document content")
    if (kind === "cv" && mode === "accepted epoch reset") {
      const paragraph = host.querySelector("[data-content-type=paragraph]")
      if (!paragraph) throw new Error("Document paragraph required")
      const text = document
        .createTreeWalker(paragraph, NodeFilter.SHOW_TEXT)
        .nextNode()
      if (!text) throw new Error("Document text required")
      const caret = () =>
        act(() => {
          host.focus()
          const range = document.createRange()
          range.setStart(text, 1)
          range.collapse(true)
          window.getSelection()?.removeAllRanges()
          window.getSelection()?.addRange(range)
          document.dispatchEvent(new Event("selectionchange"))
        })
      caret()
      expect(
        screen.queryByRole("toolbar", { name: "Selection formatting" })
      ).toBeNull()
      expect(
        screen.getByRole("toolbar", { name: "Text formatting" })
      ).toBeInTheDocument()
      fireEvent.keyDown(host, { key: "k", ctrlKey: true })
      expect(
        await screen.findByRole("dialog", { name: "Add link" })
      ).toBeVisible()
      expect(screen.getAllByRole("dialog")).toHaveLength(1)
      fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" })
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
      act(() => {
        const engine = mounted.editor
        engine.setTextCursorPosition(engine.document[0]!.id, "start")
      })
      caret()
      act(() => {
        host.focus()
        const range = document.createRange()
        range.setStart(text, 0)
        range.setEnd(text, Math.min(5, text.textContent?.length ?? 0))
        window.getSelection()?.removeAllRanges()
        window.getSelection()?.addRange(range)
        document.dispatchEvent(new Event("selectionchange"))
      })
      expect(
        await screen.findByRole("toolbar", { name: "Selection formatting" })
      ).toBeVisible()
      host.addEventListener("keydown", (event) => event.preventDefault(), {
        once: true,
      })
      fireEvent.keyDown(host, { key: "Escape" })
      expect(
        screen.queryByRole("toolbar", { name: "Selection formatting" })
      ).not.toBeInTheDocument()
    }
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Bold" })).toBeEnabled()
    )
    act(() => {
      host.focus()
      paste(host, "Unsaved Việt 😀 ")
    })
    await waitFor(() =>
      expect(JSON.stringify(client.document())).toContain("Unsaved Việt 😀")
    )
    const pending = client.stored().pending
    const reply = (reset: boolean) => ({
      provenance,
      epoch: reset ? 2 : 1,
      revision: 1,
      reset,
      stale: false,
      update: Y.encodeStateAsUpdate(remote),
      stateVector: Y.encodeStateVector(remote),
    })
    if (mode === "refused pending epoch reset") {
      const rejected = client.receive(client.prepare(), reply(true))
      expect(rejected.failed).toBe(true)
      expect(client.stored().pending).toEqual(pending)
      expect(host.childElementCount).toBeGreaterThan(0)
    }
    const sent = client.prepare()
    Y.applyUpdate(remote, sent.update)
    act(() => {
      expect(client.receive(sent, reply(false)).failed).toBe(false)
    })
    const oldDocument = client.ydoc
    const selected = window.getSelection()
    const selection = {
      anchor: selected?.anchorNode?.textContent,
      anchorOffset: selected?.anchorOffset,
      focus: selected?.focusNode?.textContent,
      focusOffset: selected?.focusOffset,
    }
    act(() => {
      const reset = reply(true)
      if (mode === "fresh-history epoch reset") {
        const saved = client.document()
        expect(saved).toBeDefined()
        if (!saved) throw new Error("Saved document required")
        const fresh = new Y.Doc()
        try {
          Y.applyUpdate(fresh, seedStoredYDoc(saved))
          expect(Y.encodeStateVector(fresh)).not.toEqual(reset.stateVector)
          reset.update = Y.encodeStateAsUpdate(fresh)
          reset.stateVector = Y.encodeStateVector(fresh)
        } finally {
          fresh.destroy()
        }
      }
      expect(client.receive(client.prepare(), reset).failed).toBe(false)
    })
    expect(client.ydoc).not.toBe(oldDocument)
    await waitFor(() => expect(host.childElementCount).toBeGreaterThan(0))
    expect(host.textContent).toContain("Unsaved Việt 😀")
    expect({
      anchor: window.getSelection()?.anchorNode?.textContent,
      anchorOffset: window.getSelection()?.anchorOffset,
      focus: window.getSelection()?.focusNode?.textContent,
      focusOffset: window.getSelection()?.focusOffset,
    }).toEqual(selection)
    expect(document.activeElement).toBe(host)
    const bold = screen.getByRole("button", { name: "Bold" })
    const pressed = bold.getAttribute("aria-pressed")
    fireEvent.click(bold)
    expect(bold).toHaveAttribute(
      "aria-pressed",
      pressed === "true" ? "false" : "true"
    )
    act(() => paste(host, "After sync "))
    await waitFor(() =>
      expect(JSON.stringify(client.document())).toContain("After sync")
    )
    expect(client.hasPending()).toBe(true)
    if (mode === "accepted epoch reset") await exerciseToolbar(host, client)
    if (mode === "accepted epoch reset") {
      act(() =>
        mounted.editor.setTextCursorPosition(
          kind === "cv" ? "intro" : "r1-a-p",
          "end"
        )
      )
      if (kind === "cv") {
        await openToolbarOverflow()
        fireEvent.click(
          await screen.findByRole("button", {
            name: "Insert table",
          })
        )
        expect(
          await screen.findByRole("spinbutton", { name: "Table rows" })
        ).toBeEnabled()
      } else {
        fireEvent.click(
          await screen.findByRole("button", {
            name: "Table options",
          })
        )
        expect(
          await screen.findByRole("button", {
            name: "Insert row below",
          })
        ).toBeEnabled()
      }
    }
    act(() => client.destroy())
    await waitFor(() => {
      expect(
        screen.queryByRole("spinbutton", { name: "Table rows" })
      ).not.toBeInTheDocument()
      expect(
        screen.queryByRole("button", { name: "Table options" })
      ).not.toBeInTheDocument()
      expect(
        screen.queryByRole("button", { name: "Insert row below" })
      ).not.toBeInTheDocument()
    })
    expect(screen.getByRole("button", { name: "Bold" })).toBeDisabled()
    fireEvent.click(screen.getByRole("button", { name: "Document menu" }))
    const download = await screen.findByRole("menuitem", {
      name: "Download Word",
    })
    expect(download).toHaveAttribute("aria-disabled", "true")
    expect(download).toHaveAccessibleDescription(
      "The document is reloading. Please wait."
    )
    fireEvent.click(download)
    expect(downloadWord).not.toHaveBeenCalled()
    const replacement = openRichPaperClient(
      {
        epoch: 2,
        revision: 1,
        provenance,
        server: seedStoredYDoc(initial),
        pending: emptyUpdate(),
      },
      { provenance }
    )
    cleanups.add(() => replacement.destroy())
    const session = vi.mocked(openRichPaperSession).mock.results.at(-1)?.value
    vi.mocked(openRichPaperSession).mockReturnValue({
      ...session,
      client: () => replacement,
    })
    view.rerender(page("remounted"))
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Bold" })).toBeEnabled()
    )
    fireEvent.click(screen.getByRole("button", { name: "Document menu" }))
    const remountedDownload = await screen.findByRole("menuitem", {
      name: "Download Word",
    })
    expect(remountedDownload).not.toHaveAttribute("aria-disabled", "true")
    fireEvent.click(remountedDownload)
    await waitFor(() => expect(downloadWord).toHaveBeenCalledOnce())
  },
  60_000
)

async function openToolbarOverflow() {
  const more = screen.getByRole("button", { name: "More formatting" })
  if (more.getAttribute("aria-expanded") !== "true") fireEvent.click(more)
}

async function exerciseToolbar(
  host: HTMLElement,
  client: ReturnType<typeof openRichPaperClient>
) {
  const errors: unknown[] = []
  const onError = (event: ErrorEvent) => errors.push(event.error)
  window.addEventListener("error", onError)
  cleanups.add(() => window.removeEventListener("error", onError))
  const user = userEvent.setup({ delay: null })
  const button = (name: string | RegExp) => screen.getByRole("button", { name })
  const more = async () => {
    const trigger = button("More formatting")
    if (trigger.getAttribute("aria-expanded") !== "true")
      await user.click(trigger)
  }
  const choose = async (name: string | RegExp, option: string) => {
    await more()
    await user.click(screen.getByRole("combobox", { name }))
    await user.click(await screen.findByRole("option", { name: option }))
  }
  const before = () => JSON.stringify(client.document())
  act(() => {
    mounted.editor.setTextCursorPosition("intro", "end")
    host.focus()
  })
  for (const name of ["Italic", "Underline", "Strikethrough"]) {
    await more()
    const pressed = button(name).getAttribute("aria-pressed")
    await user.click(button(name))
    await more()
    expect(button(name)).toHaveAttribute(
      "aria-pressed",
      pressed === "true" ? "false" : "true"
    )
  }
  await choose("Paragraph style", "Heading 1")
  await more()
  expect(
    screen.getByRole("combobox", { name: "Paragraph style" })
  ).toHaveTextContent("Heading 1")
  await choose("Paragraph style", "Normal text")
  await choose("Font", "Courier New")
  await choose("Text size", "14 pt")
  for (const [name, color] of [
    ["Text color", "Navy"],
    ["Highlight", "Yellow"],
  ]) {
    await more()
    await user.click(button(name!))
    await user.click(button(color!))
  }
  act(() => paste(host, "Formatted after reset"))
  expect(before()).toContain("liberation-mono")
  expect(before()).toContain("#1E3A8A")
  expect(before()).toContain("#FEF3C7")
  await choose(/Alignment/, "Center")
  await choose("Line spacing", "Double")
  await choose("Special indent", "First line 0.5 in")
  for (const name of [
    /Increase indent/,
    /Decrease indent/,
    "Bulleted list",
    "Numbered list",
  ]) {
    await more()
    const previous = before()
    await user.click(button(name))
    expect(before()).not.toEqual(previous)
  }
  await more()
  await user.click(button("Link"))
  const text = screen.queryByRole("textbox", {
    name: "Text to display",
  })
  if (text) await user.type(text, "Portfolio")
  await user.type(
    screen.getByRole("textbox", { name: "Link address" }),
    "https://example.com"
  )
  await user.click(button("Apply"))
  expect(before()).toContain("https://example.com")
  await more()
  await user.click(button("Remove formatting"))
  vi.stubGlobal(
    "createImageBitmap",
    vi.fn(async () => ({ width: 160, height: 200, close() {} }))
  )
  vi.mocked(uploadPaperPhoto).mockResolvedValue(
    parseFileId("15900000-0000-4000-8000-000000000002")
  )
  await more()
  await user.click(button("Insert photo"))
  fireEvent.change(screen.getByLabelText("Photo file"), {
    target: {
      files: [new File(["illustrated"], "portrait.png", { type: "image/png" })],
    },
  })
  await screen.findByRole("dialog", { name: "Edit photo" })
  await user.click(button("Apply"))
  expect(before()).toContain('"type":"photo"')
  await more()
  await user.click(button("Edit photo"))
  await screen.findByRole("dialog", { name: "Edit photo" })
  await user.click(button("Apply"))
  const withPhoto = before()
  await more()
  await user.click(button(/Undo \(/))
  expect(before()).not.toEqual(withPhoto)
  await more()
  await user.click(button(/Redo \(/))
  expect(before()).toEqual(withPhoto)
  act(() => {
    host.focus()
    fireEvent.keyDown(host, { key: "e", ctrlKey: true, shiftKey: true })
    paste(host, "Shortcut after reset")
  })
  expect(before()).toContain("Shortcut after reset")
  expect(
    (
      mounted.editor.getTextCursorPosition().block.props as {
        textAlignment?: string
      }
    ).textAlignment
  ).toBe("center")
  expect(errors).toEqual([])
}

it.each(["cv", "letter"] as const)(
  "keeps the %s table menu and focus through consecutive border choices",
  async (kind) => {
    const initial = storedFlowFixture(kind)
    const provenance = nativeProvenance(initial)
    const client = openRichPaperClient(
      {
        epoch: 1,
        revision: 0,
        provenance,
        server: seedStoredYDoc(initial),
        pending: emptyUpdate(),
      },
      { provenance }
    )
    const host = document.createElement("div")
    document.body.append(host)
    const editor = mountRichPaperEditor(client, host)
    cleanups.add(() => {
      editor.destroy()
      client.destroy()
      host.remove()
    })
    act(() => {
      editor.insertTable(2, 2)
    })
    const selected = editor.activeTable()!
    render(
      <>
        <RichTableControls editor={editor} disabled={false}>
          {() => null}
        </RichTableControls>
        <button>Outside table</button>
      </>
    )
    const user = userEvent.setup()
    await user.click(screen.getByRole("button", { name: "Table options" }))
    for (const name of ["Outer border", "Medium", "Navy border"]) {
      const choice = screen.getByRole("button", { name })
      await user.click(choice)
      expect(choice).toHaveAttribute("aria-pressed", "true")
      expect(choice).toHaveFocus()
      expect(
        screen.getByRole("dialog", { name: "Table options" })
      ).toBeVisible()
      expect(editor.activeTable()).toMatchObject({
        table: { id: selected.table.id },
        rowIndex: selected.rowIndex,
        columnIndex: selected.columnIndex,
      })
    }
    await user.keyboard("{Escape}")
    expect(screen.queryByRole("dialog", { name: "Table options" })).toBeNull()
    await user.click(screen.getByRole("button", { name: "Table options" }))
    await user.click(screen.getByRole("button", { name: "Thin" }))
    await user.click(screen.getByRole("button", { name: "Outside table" }))
    expect(screen.queryByRole("dialog", { name: "Table options" })).toBeNull()
  }
)
