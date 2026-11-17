import { expect, it } from "vitest"
import { undo } from "y-prosemirror"
import { inlineCss, paragraphCss } from "./native-formatting-render-values.js"
import {
  inlineSchema,
  paragraphSchema,
} from "@workspace/domain/internal/paper-presentation"
import { setup } from "./native-layout-test-setup.js"

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
    expect(paragraph?.style.fontFamily).toContain("Liberation Serif")
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
