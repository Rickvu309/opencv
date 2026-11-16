import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { TextSelection } from "@tiptap/pm/state"
import { undo, redo } from "y-prosemirror"
import * as Y from "yjs"
import { nativeProvenance, richPaperDocumentSchema } from "@workspace/domain"
import { openRichPaperClient, type PaperClient } from "./client.js"
import type { RichPaperDocument } from "@workspace/domain"
import { seedStoredYDoc } from "./stored-document.js"
import { recoverRichPaperClient } from "./rich-recovery.js"
import { borrowFlowDocument } from "./native-layout-flow.js"
import { mountPrivateFlow } from "./native-layout-flow-mount.js"
import { mountRichPaperEditor } from "./editor.js"
import { storedFlowFixture } from "./test/flow-fixture.js"

const cleanups: (() => void)[] = []
beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    }
  )
  const fonts = Object.getOwnPropertyDescriptor(document, "fonts")
  Object.defineProperty(document, "fonts", {
    configurable: true,
    value: { ready: Promise.resolve() },
  })
  cleanups.push(() => {
    if (fonts) Object.defineProperty(document, "fonts", fonts)
    else Reflect.deleteProperty(document, "fonts")
  })
})
afterEach(() => {
  for (const cleanup of cleanups.reverse()) cleanup()
  cleanups.length = 0
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})
function setup(kind: "cv" | "letter") {
  const input = storedFlowFixture(kind)
  const document = richPaperDocumentSchema.parse({
    ...input,
    flow: {
      ...input.flow,
      children: input.flow.children.map((section) => ({
        ...section,
        children: section.children.filter(
          (node) => node.type === "paragraph" || node.type === "header"
        ),
      })),
    },
  })
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
  cleanups.push(() => client.destroy())
  const host = globalThis.document.createElement("div")
  globalThis.document.body.append(host)
  cleanups.push(() => host.remove())
  const lease = borrowFlowDocument(client.ydoc, kind)
  cleanups.push(() => lease.release())
  const mounted = mountPrivateFlow(lease.binding, host)
  cleanups.push(() => mounted.unmount())
  const view = mounted.editor.prosemirrorView
  function select(from = "intro", to = from, start = 0, end?: number) {
    mounted.editor.setTextCursorPosition(from, "start")
    const anchor = view.state.selection.from + start
    mounted.editor.setTextCursorPosition(to, "end")
    view.dispatch(
      view.state.tr.setSelection(
        TextSelection.create(
          view.state.doc,
          anchor,
          end === undefined ? view.state.selection.to : anchor + end
        )
      )
    )
  }
  select()
  return { client, mounted, view, select, host }
}
function paragraph(client: PaperClient<RichPaperDocument>, id = "intro") {
  const result = client
    .document()
    ?.flow.children[0]?.children.find((node) => node.id === id)
  if (result?.type !== "paragraph") throw new Error("Missing paragraph")
  return result
}

describe("rich Paper selection formatting", () => {
  it.each(["cv", "letter"] as const)(
    "keeps every %s choice through Undo, Redo, offline recovery, save and reload",
    (kind) => {
      const { client, mounted, view } = setup(kind)
      const choices = [
        () => mounted.formatInline({ color: "#1E3A8A" }),
        () => mounted.formatInline({ highlight: "#FEF3C7" }),
        () => mounted.formatInline({ fontId: "liberation-mono" }),
        () => mounted.formatInline({ size: 280 }),
        () => mounted.formatParagraph({ alignment: "justify" }),
        () =>
          mounted.formatParagraph({
            lineSpacing: { kind: "multiple", value: 1.5 },
          }),
        () => mounted.formatParagraph({ start: 720 }),
        () =>
          mounted.formatParagraph({ indent: { kind: "hanging", value: 360 } }),
      ]
      for (const choose of choices) {
        const before = client.document()
        choose()
        const after = client.document()
        expect(after).not.toEqual(before)
        expect(undo(view.state)).toBe(true)
        expect(client.document()).toEqual(before)
        expect(redo(view.state)).toBe(true)
        expect(client.document()).toEqual(after)
      }
      expect(mounted.activeFormatting()).toMatchObject({
        color: "#1E3A8A",
        highlight: "#FEF3C7",
        fontId: "liberation-mono",
        size: "14",
        alignment: "justify",
        lineSpacing: "1.5",
        start: "0.5",
        indent: "hanging:360",
      })
      const expected = client.document()
      expect(paragraph(client)).toMatchObject({
        paragraph: {
          alignment: "justify",
          lineSpacing: { kind: "multiple", value: 1.5 },
          start: 720,
          indent: { kind: "hanging", value: 360 },
        },
        content: [
          {
            color: "#1E3A8A",
            highlight: "#FEF3C7",
            fontId: "liberation-mono",
            size: 280,
          },
        ],
      })
      const checkpoint = client.stored()
      const provenance = checkpoint.provenance!
      const recovered = recoverRichPaperClient(
        { ...checkpoint, pending: Uint8Array.of(0, 0) },
        [checkpoint],
        provenance
      )
      cleanups.push(() => recovered.destroy())
      expect(recovered.hasPending()).toBe(true)
      expect(recovered.document()).toEqual(expected)
      const remote = new Y.Doc()
      cleanups.push(() => remote.destroy())
      Y.applyUpdate(remote, checkpoint.server)
      const sent = recovered.prepare()
      Y.applyUpdate(remote, sent.update)
      expect(
        recovered.receive(sent, {
          provenance,
          epoch: 1,
          revision: 1,
          reset: false,
          stale: false,
          update: Y.encodeStateAsUpdate(remote),
          stateVector: Y.encodeStateVector(remote),
        }).failed
      ).toBe(false)
      expect(recovered.hasPending()).toBe(false)
      const reloaded = openRichPaperClient(recovered.stored(), { provenance })
      cleanups.push(() => reloaded.destroy())
      expect(reloaded.document()).toEqual(expected)
      expect(reloaded.rebuilds).toBe(0)
    }
  )

  it("reads mixed runs and paragraphs, then applies to the entire selection without changing other text", () => {
    const { client, mounted, select } = setup("letter")
    select("intro", "intro", 0, 4)
    mounted.formatInline({ color: "#166534", size: 280 })
    expect(mounted.activeFormatting()).toMatchObject({
      color: "#166534",
      size: "14",
    })
    select("intro", "after")
    expect(mounted.activeFormatting()).toMatchObject({
      color: null,
      size: null,
    })
    mounted.formatParagraph({ alignment: "center" })
    mounted.formatInline({ color: "#1E3A8A" })
    expect(mounted.activeFormatting()).toMatchObject({
      color: "#1E3A8A",
      alignment: "center",
      size: null,
    })
    select("after")
    expect(mounted.activeFormatting().size).toBe("12")
    mounted.formatParagraph({ alignment: "left" })
    select("intro", "after")
    expect(mounted.activeFormatting().alignment).toBe(null)
    expect(paragraph(client).paragraph.alignment).toBe("center")
  })

  it("uses the caret choices for new text and can reset a selected highlight", () => {
    const { client, mounted, select, view } = setup("letter")
    select("intro", "intro", 0, 0)
    mounted.formatInline({
      color: "#7F1D1D",
      highlight: "#DBEAFE",
      fontId: "liberation-serif",
      size: 220,
    })
    expect(mounted.activeFormatting()).toMatchObject({
      color: "#7F1D1D",
      fontId: "liberation-serif",
      size: "11",
    })
    view.dispatch(view.state.tr.insertText("New "))
    expect(paragraph(client).content[0]).toMatchObject({
      text: "New ",
      color: "#7F1D1D",
      highlight: "#DBEAFE",
      fontId: "liberation-serif",
      size: 220,
    })
    select("intro", "intro", 0, 4)
    mounted.formatInline({ highlight: null })
    expect(paragraph(client).content[0]?.highlight).toBeUndefined()
    expect(mounted.activeFormatting().highlight).toBe("default")
  })

  it("notifies subscribers for caret marks and resets, preserves selection and returns focus", () => {
    const { client, mounted, host, select } = setup("letter")
    select("intro", "intro", 2, 0)
    mounted.unmount()
    const editor = mountRichPaperEditor(client, host)
    cleanups.push(() => editor.destroy())
    const values: unknown[] = []
    const detach = editor.subscribe(() =>
      values.push(editor.activeFormatting())
    )
    cleanups.push(detach)
    const button = document.createElement("button")
    host.append(button)
    button.focus()
    editor.formatInline({ size: 280, color: "#B91C1C" })
    expect(values.at(-1)).toMatchObject({ size: "14", color: "#B91C1C" })
    expect(document.activeElement?.getAttribute("aria-label")).toBe(
      "Document content"
    )
    editor.formatInline({ size: null, color: null })
    expect(values.at(-1)).toMatchObject({ size: "11", color: "#000000" })
    const notifications = values.length
    detach()
    editor.formatInline({ size: 320 })
    expect(values).toHaveLength(notifications)
    editor.destroy()
    expect(editor.activeFormatting()).toBeNull()
    expect(() => editor.formatInline({ size: 280 })).toThrow("closed")
    expect(() => editor.formatParagraph({ alignment: "center" })).toThrow(
      "closed"
    )
    expect(() => editor.toggleMark("bold")).toThrow("closed")
  })

  it("shows effective values across empty paragraphs without inventing mixed formatting", () => {
    const { mounted, view, select } = setup("letter")
    select("intro")
    view.dispatch(view.state.tr.deleteSelection())
    select("after")
    view.dispatch(view.state.tr.deleteSelection())
    select("intro", "after")
    expect(mounted.activeFormatting()).toMatchObject({
      hasText: true,
      size: "11",
      fontId: "liberation-serif",
      color: "#000000",
      lineSpacing: "1.2",
    })
  })

  it("rejects unsupported fonts, malformed colors and non-Word sizes without a change", () => {
    const { client, mounted } = setup("letter")
    const before = client.state()
    expect(() => mounted.formatInline({ fontId: "unshipped" })).toThrow()
    expect(() => mounted.formatInline({ color: "red" })).toThrow()
    expect(() => mounted.formatInline({ size: 225 })).toThrow("half points")
    expect(client.state()).toEqual(before)
  })
})
