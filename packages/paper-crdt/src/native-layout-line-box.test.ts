import { TextSelection } from "@tiptap/pm/state"
import * as Y from "yjs"
import {
  nativeProvenance,
  richPaperDocumentSchema,
  storedPaperDocumentSchema,
} from "@workspace/domain/paper-doc"
import { openRichPaperClient } from "./client.js"
import { storedFlowFixture } from "./test/flow-fixture.js"
import { describe, expect, it } from "vitest"
import { undo, redo } from "y-prosemirror"
import { inlineCss, paragraphCss } from "./native-formatting-render-values.js"
import {
  inlineSchema,
  paragraphSchema,
} from "@workspace/domain/internal/paper-presentation"
import { cleanups, paragraph, setup } from "./native-layout-test-setup.js"

it("steps each run of a mixed-size selection from its own size and restores them in one Undo", () => {
  const { mounted, select, view, host } = setup("letter")
  const sizes = () => [
    ...new Set(
      [
        ...host.querySelectorAll<HTMLElement>(
          '[data-id="intro"] [data-paper-resolved]'
        ),
      ].map((run) => run.style.fontSize)
    ),
  ]
  select("intro", "intro", 0, 4)
  mounted.formatInline({ size: 200 })
  select("intro", "intro", 4, 4)
  mounted.formatInline({ size: 480 })
  select("intro", "intro", 8, 4)
  mounted.formatInline({ size: 200 })
  select("intro", "intro", 0, 12)
  expect(mounted.activeFormatting().size).toBeNull()
  mounted.stepTextSize(10)
  expect(sizes()).toEqual(expect.arrayContaining(["10.5pt", "24.5pt"]))
  expect(sizes()).not.toEqual(expect.arrayContaining(["10pt"]))
  expect(sizes()).not.toEqual(expect.arrayContaining(["11.5pt"]))
  select("intro", "intro", 0, 12)
  mounted.stepTextSize(-10)
  select("intro", "intro", 0, 12)
  mounted.stepTextSize(-10)
  expect(sizes()).toEqual(expect.arrayContaining(["9.5pt", "23.5pt"]))
  expect(undo(view.state)).toBe(true)
  expect(sizes()).toEqual(expect.arrayContaining(["10pt", "24pt"]))
  expect(sizes()).not.toEqual(expect.arrayContaining(["9.5pt"]))
  select("intro", "intro", 0, 0)
  mounted.stepTextSize(-10)
  expect(mounted.activeFormatting().size).toBe("9.5")
})
it.each([20, 3200])(
  "renders an at-least %s twip minimum on mixed-size runs",
  (minimum) => {
    const { mounted, select, host } = setup("letter")
    select("intro", "intro", 0, 4)
    mounted.formatInline({ size: 480 })
    select("intro", "intro", 4, 4)
    mounted.formatInline({ size: 220 })
    mounted.formatParagraph({
      lineSpacing: { kind: "atleast", value: minimum },
    })
    const runs = [
      ...host.querySelectorAll<HTMLElement>(
        '[data-id="intro"] [data-paper-resolved]'
      ),
    ]
    expect(runs.some((run) => run.style.fontSize === "24pt")).toBe(true)
    expect(runs.some((run) => run.style.fontSize === "11pt")).toBe(true)
    const { lineSpacing } = paragraphSchema.parse({
      lineSpacing: { kind: "atleast", value: minimum },
    })
    const sizes = [220, 480].map((size) => inlineSchema.parse({ size }).size)
    const lineHeight = `line-height:max(${minimum / 20}pt,${2355 / 2048}em)`
    expect(paragraphCss({ lineSpacing })).toContain(lineHeight)
    for (const size of sizes)
      expect(inlineCss({ size }, lineSpacing)).toContain(lineHeight)
    expect(runs.every((run) => !run.style.lineHeight.includes("1.2em"))).toBe(
      true
    )
  }
)

it.each([
  [{ kind: "atleast", value: 240 }, `max(12pt,${2355 / 2048}em)`],
  [{ kind: "exact", value: 253 }, "12.65pt"],
] as const)(
  "sizes the %o paragraph line box from the paragraph's own text, not the page font",
  (input, lineHeight) => {
    const { lineSpacing } = paragraphSchema.parse({ lineSpacing: input })
    const multiple = paragraphSchema.parse({
      lineSpacing: { kind: "multiple", value: 1.5 },
    })
    const eleven = inlineSchema.parse({ size: 220 })
    if (!lineSpacing) throw new Error("Missing line spacing")
    const { mounted, select, host } = setup("letter")
    select("intro", "intro", 0, 4)
    mounted.formatInline({ size: 220, fontId: "liberation-mono" })
    mounted.formatParagraph({ lineSpacing })
    const paragraph = host.querySelector<HTMLElement>(
      '[data-id="intro"] .bn-block-content'
    )
    expect(paragraph?.style.fontSize).toBe("11pt")
    expect(paragraph?.style.fontFamily).toContain(
      lineSpacing.kind === "atleast" ? "Liberation Mono" : "Liberation Serif"
    )
    expect(paragraphCss({ lineSpacing }, eleven)).toContain(
      `font-size:11pt;line-height:${lineHeight}`
    )
    expect(
      paragraphCss(
        { lineSpacing },
        inlineSchema.parse({ fontId: "liberation-mono" })
      )
    ).toContain(
      lineSpacing.kind === "atleast" ? `${2320 / 2048}em` : "Liberation Mono"
    )
    expect(paragraphCss({ lineSpacing })).not.toContain("1.2em")
    expect(paragraphCss(multiple)).toBe(
      paragraphCss(multiple, inlineSchema.parse({ size: 480 }))
    )
    const runs = [
      ...host.querySelectorAll<HTMLElement>(
        '[data-id="intro"] [data-paper-resolved]'
      ),
    ]
    expect(runs.length).toBeGreaterThan(0)
    if (lineSpacing.kind === "exact") {
      expect(paragraph?.style.lineHeight).toBe(lineHeight)
      for (const run of runs) expect(run.style.lineHeight).toBe("0")
    } else
      expect(inlineCss(eleven, lineSpacing)).toContain(
        `line-height:${lineHeight}`
      )
  }
)

it.each(["cv", "letter"] as const)(
  "uses actual small runs for the %s At least strut and grows with larger runs",
  (kind) => {
    const { mounted, select, host } = setup(kind)
    select("intro")
    mounted.formatInline({ size: 160 })
    mounted.formatParagraph({ lineSpacing: { kind: "atleast", value: 20 } })
    const paragraph = host.querySelector<HTMLElement>(
      '[data-id="intro"] .bn-block-content'
    )
    expect(paragraph?.style.fontSize).toBe("8pt")
    select("intro", "intro", 0, 4)
    mounted.formatInline({ size: 480 })
    expect(paragraph?.style.fontSize).toBe("8pt")
    expect(
      host.querySelector('[data-id="intro"] [style*="24pt"]')
    ).not.toBeNull()
    select("intro")
    mounted.formatInline({ size: 480 })
    expect(paragraph?.style.fontSize).toBe("24pt")
  }
)

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

it.each(["cv", "letter"] as const)(
  "opens stored %s line multiples unchanged and refuses new unsupported edits before mutation",
  (kind) => {
    for (const value of [1.001, 1.01, 1.23]) {
      const input = storedFlowFixture(kind)
      const paragraph = input.flow.children[0]?.children.find(
        (node) => node.type === "paragraph"
      )
      if (paragraph?.type !== "paragraph") throw new Error("Missing paragraph")
      paragraph.paragraph.lineSpacing = { kind: "multiple", value }
      expect(storedPaperDocumentSchema.parse(input)).toEqual(input)
      expect(richPaperDocumentSchema.parse(input)).toEqual(input)
      const { client, mounted, select, view } = setup(kind, input)
      const before = client.document()
      select(paragraph.id)
      for (const apply of [
        () =>
          mounted.formatParagraph({ lineSpacing: { kind: "multiple", value } }),
        () =>
          mounted.formatTypography({
            size: 320,
            lineSpacing: { kind: "multiple", value },
          }),
      ]) {
        expect(apply).toThrow("exact Word units")
        expect(client.document()).toEqual(before)
      }
      mounted.formatParagraph({ before: 123 })
      expect(client.document()).not.toEqual(before)
      expect(undo(view.state)).toBe(true)
      expect(client.document()).toEqual(before)
    }
  }
)
