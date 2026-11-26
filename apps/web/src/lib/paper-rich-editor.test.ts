import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { nativeProvenance } from "@workspace/domain/paper-doc"
import {
  emptyUpdate,
  openRichPaperClient,
  seedStoredYDoc,
} from "@workspace/paper-crdt"
import { mountRichEditorLifecycle } from "../features/paper/rich-editor/rich-editor-lifecycle.ts"
import { mountRichPaperEditor } from "@workspace/paper-crdt/editor"
import { storedFlowFixture } from "../../../../packages/paper-crdt/src/test/flow-fixture.ts"

const cleanups = new Set<() => void>()
const liveFonts = Object.getOwnPropertyDescriptor(document, "fonts")
beforeEach(() => {
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
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  if (liveFonts) Object.defineProperty(document, "fonts", liveFonts)
  else Reflect.deleteProperty(document, "fonts")
})

it.each(["cv", "letter"] as const)(
  "edits the owned %s document and releases the editor before client destruction",
  async (kind) => {
    const document = storedFlowFixture(kind)
    const client = openRichPaperClient(
      {
        epoch: 1,
        revision: 0,
        provenance: nativeProvenance(document),
        server: seedStoredYDoc(document),
        pending: emptyUpdate(),
      },
      { provenance: nativeProvenance(document) }
    )
    const host = window.document.createElement("div")
    window.document.body.append(host)
    const onRelease = vi.fn()
    const mounted = mountRichPaperEditor(client, host, { onRelease })
    cleanups.add(() => {
      mounted.destroy()
      client.destroy()
      host.remove()
    })
    expect(host.getAttribute("aria-label")).toBe("Document content")
    mounted.focus()
    mounted.toggleMark("underline")
    expect(mounted.activeMarks().underline).toBe(true)
    const paste = new Event("paste", { bubbles: true, cancelable: true })
    Object.defineProperty(paste, "clipboardData", {
      value: {
        getData: (name: string) =>
          name === "text/plain" ? "Saved Việt 😀 " : "",
        types: ["text/plain"],
        files: [],
      },
    })
    host.dispatchEvent(paste)
    await vi.waitFor(() =>
      expect(JSON.stringify(client.document())).toContain("Saved Việt 😀")
    )
    expect(client.hasPending()).toBe(true)
    const stored = client.stored()
    const reopened = openRichPaperClient(stored, {
      provenance: stored.provenance!,
    })
    try {
      expect(reopened.document()).toEqual(client.document())
    } finally {
      reopened.destroy()
    }
    mounted.setEditable(false)
    const blocked = client.document()
    mounted.toggleMark("bold")
    host.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "b",
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      })
    )
    expect(client.document()).toEqual(blocked)
    mounted.setEditable(true)
    mounted.restoreSelection({
      plain: { anchor: 1e6, head: 1e6 },
      focused: true,
    })
    expect(window.document.activeElement).toBe(host)
    expect(window.getSelection()?.anchorNode).not.toBeNull()
    expect(host.contains(window.getSelection()?.anchorNode ?? null)).toBe(true)
    const captured = mounted.captureSelection()
    expect(captured?.focused).toBe(true)
    client.destroy()
    expect(onRelease).toHaveBeenCalledExactlyOnceWith(captured)
    mounted.destroy()
    expect(onRelease).toHaveBeenCalledTimes(1)
    expect(() => mounted.toggleMark("bold")).toThrow("closed")
    expect(host.childElementCount).toBe(0)
  }
)

it.each(["cv", "letter"] as const)(
  "makes every released %s control harmless",
  (kind) => {
    const input = storedFlowFixture(kind)
    const provenance = nativeProvenance(input)
    const client = openRichPaperClient(
      {
        epoch: 1,
        revision: 0,
        provenance,
        server: seedStoredYDoc(input),
        pending: emptyUpdate(),
      },
      { provenance }
    )
    const host = document.createElement("div")
    document.body.append(host)
    let editor: ReturnType<typeof mountRichPaperEditor> | undefined
    const release = mountRichEditorLifecycle(client, host, {
      mounted(handle) {
        editor = handle
      },
      released() {},
      failed() {
        throw new Error("Mount failed")
      },
    })
    if (!editor) throw new Error("Mounted editor required")
    cleanups.add(() => {
      release()
      client.destroy()
      host.remove()
    })
    const selection = editor.captureSelection()
    client.destroy()
    const action = vi.fn()
    const listener = vi.fn()
    expect(editor.apply(action)).toBe(false)
    expect(action).not.toHaveBeenCalled()
    expect(editor.focus()).toBe(false)
    expect(editor.captureSelection()).toBeUndefined()
    editor.restoreSelection(selection)
    editor.setEditable(true)
    for (const mark of ["bold", "italic", "underline", "strike"] as const)
      editor.toggleMark(mark)
    editor.formatInline({ color: "#112233" })
    editor.formatParagraph({ alignment: "center" })
    editor.adjustIndent(360)
    editor.setParagraphStyle("heading-1")
    editor.toggleList("bulletListItem")
    editor.toggleList("numberedListItem")
    editor.listLevel("in")
    editor.listLevel("out")
    expect(editor.setLink("https://example.com", "Work")).toBe(false)
    editor.removeLink()
    editor.clearFormatting()
    editor.undo()
    editor.redo()
    editor.undoDocument()
    editor.redoDocument()
    expect(editor.insertPhoto("invalid while away")).toBeNull()
    editor.updatePhoto({})
    editor.replacePhoto("missing", "invalid while away")
    editor.removePhoto("missing")
    editor.selectPhoto("missing")
    editor.subscribe(listener)()
    expect(listener).not.toHaveBeenCalled()
    expect(editor.photos()).toEqual([])
    expect(editor.selectedPhoto()).toBeNull()
    expect(editor.documentHistory()).toEqual({ undo: false, redo: false })
    expect(editor.formattingState()).toBeNull()
    expect(editor.activeFormatting()).toBeNull()
    expect(editor.activeMarks()).toEqual({})
    expect(host.childElementCount).toBe(0)
    expect(document.activeElement).not.toBe(host)
    editor.destroy()
  }
)
