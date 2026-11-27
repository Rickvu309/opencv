import { afterEach, expect, it } from "vitest"
import { cleanup, render, waitFor } from "@testing-library/react"

import { layoutPageSchema } from "@workspace/domain/paper-doc"
import { createLayouter, paperFontMetrics } from "@workspace/paper-engine"

import { px } from "./editor/painter.ts"
import { labDocument } from "./editor/lab-documents.ts"
import { PaperFirstPage } from "./paper-first-page.tsx"

afterEach(cleanup)

it("paints the card's line boxes equal to Layout page 1 for a corpus CV", async () => {
  const doc = labDocument("en-10")
  const layout = createLayouter(paperFontMetrics).layout(doc, null)
  const page = layoutPageSchema.parse(layout.pages[0]!)
  const { container } = render(<PaperFirstPage page={page} />)
  const stage = container.querySelector<HTMLElement>(
    '[data-slot="paper-first-page"]'
  )
  await waitFor(() =>
    expect(stage!.querySelector(".paper-line")).not.toBe(null)
  )
  const painted = [...stage!.querySelectorAll<HTMLElement>(".paper-line")]
  const expected = layout.pages[0]!.boxes.filter((box) => box.kind === "line")
  expect(painted).toHaveLength(expected.length)
  for (const [index, box] of expected.entries()) {
    const el = painted[index]!
    expect(el.dataset.block).toBe(box.block)
    expect(el.style.left).toBe(`${px(box.rect.x)}px`)
    expect(el.style.top).toBe(`${px(box.rect.y)}px`)
    expect(el.style.width).toBe(`${px(box.rect.w)}px`)
    expect(el.style.height).toBe(`${px(box.rect.h)}px`)
    const spans = [...el.querySelectorAll<HTMLElement>(".paper-run")].filter(
      (span) => span.dataset.marker === undefined
    )
    expect(spans.map((span) => span.textContent)).toEqual(
      box.segments.map((segment) => segment.text)
    )
  }
})

it("keeps the card's sheet empty when the stored page is blank", async () => {
  const doc = labDocument(null)
  const layout = createLayouter(paperFontMetrics).layout(doc, null)
  const page = layoutPageSchema.parse(layout.pages[0]!)
  const { container } = render(<PaperFirstPage page={page} />)
  const stage = container.querySelector<HTMLElement>(
    '[data-slot="paper-first-page"]'
  )
  await waitFor(() =>
    expect(stage!.querySelector(".paper-line")).not.toBe(null)
  )
  const painted = [...stage!.querySelectorAll(".paper-line")]
  expect(painted).toHaveLength(1)
  expect(painted[0]!.textContent).toBe("")
})
