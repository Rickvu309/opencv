import { describe, expect, it } from "vitest"
import { TextSelection } from "@tiptap/pm/state"
import { undo, redo } from "y-prosemirror"
import * as Y from "yjs"
import { nativeProvenance } from "@workspace/domain"
import { openRichPaperClient } from "./client.js"
import { recoverRichPaperClient } from "./rich-recovery.js"
import { mountRichPaperEditor } from "./editor.js"
import { cleanups, paragraph, setup } from "./native-layout-test-setup.js"

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

it("adjusts mixed paragraph indents relative to each effective depth and restores them in one Undo", () => {
  const { mounted, client, select, view } = setup("letter")
  select("intro")
  mounted.formatParagraph({ start: 360 })
  select("after")
  mounted.formatParagraph({ start: 720 })
  select("intro", "after")
  expect(mounted.activeFormatting().start).toBeNull()
  mounted.adjustIndent(360)
  expect(paragraph(client).paragraph?.start).toBe(720)
  expect(paragraph(client, "after").paragraph?.start).toBe(1080)
  expect(undo(view.state)).toBe(true)
  expect(paragraph(client).paragraph?.start).toBe(360)
  expect(paragraph(client, "after").paragraph?.start).toBe(720)
  expect(redo(view.state)).toBe(true)
  mounted.adjustIndent(-360)
  expect(paragraph(client).paragraph?.start).toBe(360)
  expect(paragraph(client, "after").paragraph?.start).toBe(720)
})
it("moves a hanging paragraph on the first increase and decrease and respects bounds", () => {
  const { mounted, client } = setup("letter")
  mounted.formatParagraph({ start: 0, indent: { kind: "hanging", value: 720 } })
  mounted.adjustIndent(360)
  expect(paragraph(client).paragraph).toMatchObject({
    start: 1080,
    indent: { kind: "hanging", value: 720 },
  })
  mounted.formatParagraph({ start: 0, indent: { kind: "hanging", value: 720 } })
  mounted.adjustIndent(-360)
  expect(paragraph(client).paragraph).toMatchObject({
    start: 360,
    indent: { kind: "hanging", value: 360 },
  })
  mounted.adjustIndent(-360)
  mounted.adjustIndent(-360)
  expect(paragraph(client).paragraph?.start).toBe(0)
  mounted.formatParagraph({ start: 2880 })
  mounted.adjustIndent(360)
  expect(paragraph(client).paragraph?.start).toBe(2880)
})

describe("exact rich Paper typography", () => {
  it.each(["cv", "letter"] as const)(
    "stores %s half points and paragraph spacing in one reversible edit",
    (kind) => {
      const { client, mounted, view, select, host } = setup(kind)
      const before = client.document()
      mounted.formatTypography({
        size: 210,
        before: 125,
        after: 85,
        lineSpacing: { kind: "multiple", value: 1.25 },
      })
      expect(paragraph(client)).toMatchObject({
        paragraph: {
          before: 125,
          after: 85,
          lineSpacing: { kind: "multiple", value: 1.25 },
        },
      })
      expect(paragraph(client).content.every((run) => run.size === 210)).toBe(
        true
      )
      expect(host.querySelector('[data-id="intro"]')?.textContent).toBeTruthy()
      const text = [...host.querySelectorAll("span")].find(
        (element) => element.style.fontSize === "10.5pt"
      )
      expect(text).toBeTruthy()
      const rendered = host.querySelector<HTMLElement>(
        '[data-id="intro"] .bn-block-content'
      )
      expect(rendered?.style.marginBlockStart).toBe("6.25pt")
      expect(rendered?.style.marginBlockEnd).toBe("4.25pt")
      expect(rendered?.style.lineHeight).toBe("1.25")
      expect(mounted.activeFormatting()).toMatchObject({
        size: "10.5",
        before: "6.25",
        after: "4.25",
        lineValue: "1.25",
        lineKind: "multiple",
      })
      const after = client.document()
      expect(undo(view.state)).toBe(true)
      expect(client.document()).toEqual(before)
      expect(redo(view.state)).toBe(true)
      expect(client.document()).toEqual(after)
      const provenance = nativeProvenance(after!)
      const reopened = openRichPaperClient(
        {
          epoch: 1,
          revision: 1,
          provenance,
          server: Y.encodeStateAsUpdate(client.ydoc),
          pending: Uint8Array.of(0, 0),
        },
        { provenance }
      )
      cleanups.push(() => reopened.destroy())
      expect(reopened.document()).toEqual(after)
      select("intro", "after")
      expect(mounted.activeFormatting()).toMatchObject({
        size: null,
        before: null,
        after: null,
        lineValue: null,
      })
    }
  )

  it.each(["exact", "atleast"] as const)(
    "keeps custom %s point line spacing",
    (kind) => {
      const { mounted, client } = setup("letter")
      mounted.formatParagraph({
        before: 0,
        after: 150,
        lineSpacing: { kind, value: 285 },
      })
      expect(paragraph(client).paragraph).toMatchObject({
        before: 0,
        after: 150,
        lineSpacing: { kind, value: 285 },
      })
      expect(mounted.activeFormatting()).toMatchObject({
        before: "0",
        after: "7.5",
        lineKind: kind,
        lineValue: "14.25",
      })
    }
  )

  it("keeps an exact typing size while changing the current paragraph spacing", () => {
    const { mounted, client, view } = setup("letter")
    view.dispatch(
      view.state.tr.setSelection(
        TextSelection.create(view.state.doc, view.state.selection.from)
      )
    )
    mounted.formatTypography({ size: 210, before: 125 })
    expect(mounted.activeFormatting()).toMatchObject({
      size: "10.5",
      before: "6.25",
    })
    view.dispatch(view.state.tr.insertText("Typed"))
    expect(
      paragraph(client).content.find((run) => run.text.includes("Typed"))?.size
    ).toBe(210)
  })

  it("refuses invalid typography atomically", () => {
    const { mounted, client } = setup("letter")
    const before = client.document()
    for (const patch of [
      { size: 70 },
      { size: 211 },
      { size: 210, before: -1 },
      { size: 210, after: 31681 },
      { size: 210, lineSpacing: { kind: "multiple" as const, value: 11 } },
    ]) {
      expect(() => mounted.formatTypography(patch)).toThrow()
      expect(client.document()).toEqual(before)
    }
  })
})
