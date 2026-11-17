import { expect, it } from "vitest"
import { measuredPageBreaks, type LayoutUnit } from "./measured-page-breaks.js"

const page = { height: 1056, top: 96, bottom: 96, gap: 24 }
const unit = (
  pos: number,
  top: number,
  bottom: number,
  kind: LayoutUnit["kind"] = "line",
  keepWithNext = false
): LayoutUnit => ({
  pos,
  end: pos + 1,
  top,
  bottom,
  kind,
  keepWithNext,
  paragraph: null,
})

it("splits a paragraph by complete lines before the bottom margin", () => {
  expect(
    measuredPageBreaks(
      [unit(1, 936, 960), unit(2, 960, 984), unit(3, 984, 1008)],
      page
    )
  ).toEqual([{ pos: 2, end: 3, height: 216, kind: "line" }])
})

it("moves a heading with its first following line", () => {
  expect(
    measuredPageBreaks(
      [unit(1, 912, 944, "block", true), unit(2, 944, 968)],
      page
    )
  ).toEqual([{ pos: 1, end: 2, height: 264, kind: "block" }])
})

it("moves photos and whole table rows to the next content box", () => {
  for (const kind of ["block", "row"] as const)
    expect(measuredPageBreaks([unit(1, 900, 1000, kind)], page)).toEqual([
      { pos: 1, end: 2, height: 276, kind },
    ])
})

it("reserves a full content box for an oversized row and resumes after it", () => {
  expect(
    measuredPageBreaks([unit(1, 200, 1064, "row"), unit(2, 1064, 1090)], page)
  ).toEqual([
    { pos: 1, end: 2, height: 976, kind: "row" },
    { pos: 2, end: 3, height: 216, kind: "line" },
  ])
})

it("honors manual breaks and keeps already aligned lines on their page", () => {
  expect(
    measuredPageBreaks([unit(1, 400, 400, "break"), unit(2, 400, 424)], page)
  ).toEqual([{ pos: 1, end: 2, height: 776, kind: "break" }])
  expect(measuredPageBreaks([unit(1, 1176, 1200)], page)).toEqual([])
})

it("uses A4 and changed margins without rounding lines into a margin", () => {
  const a4 = { height: 16838 / 15, top: 72, bottom: 120, gap: 24 }
  const offset = measuredPageBreaks([unit(1, 990, 1014)], a4)[0]!
  expect(990 + offset.height).toBeCloseTo(a4.height + a4.gap + a4.top)
})

const paragraph = (
  start: number,
  top: number,
  count: number,
  properties = { keepTogether: false, widowOrphan: true, keepNext: false }
): LayoutUnit[] =>
  Array.from({ length: count }, (_, line) => ({
    ...unit(start + line, top + line * 24, top + (line + 1) * 24),
    keepWithNext: properties.keepNext,
    paragraph: { id: start, line, count, ...properties },
  }))

it("moves an orphan to keep two lines at the paragraph start by default", () => {
  expect(measuredPageBreaks(paragraph(1, 936, 6), page)).toEqual([
    { pos: 1, end: 2, height: 240, kind: "line" },
  ])
})

it("backs up the break to keep two widow lines on the next page", () => {
  expect(measuredPageBreaks(paragraph(1, 840, 6), page)).toEqual([
    { pos: 5, end: 6, height: 240, kind: "line" },
  ])
})

it.each([2, 3])(
  "keeps a %i-line paragraph whole with widow control",
  (count) => {
    expect(measuredPageBreaks(paragraph(1, 936, count), page)[0]?.pos).toBe(1)
  }
)

it("allows single orphan and widow lines when the document disables control", () => {
  const properties = {
    widowOrphan: false,
    keepTogether: false,
    keepNext: false,
  }
  expect(
    measuredPageBreaks(paragraph(1, 936, 6, properties), page)[0]?.pos
  ).toBe(2)
  expect(
    measuredPageBreaks(paragraph(1, 840, 6, properties), page)[0]?.pos
  ).toBe(6)
})

it("keeps an entire paragraph together when it fits on a page", () => {
  const properties = { widowOrphan: false, keepTogether: true, keepNext: false }
  expect(
    measuredPageBreaks(paragraph(1, 840, 6, properties), page)[0]?.pos
  ).toBe(1)
})

it("splits an oversized keep-together paragraph without losing widow control", () => {
  const properties = { widowOrphan: true, keepTogether: true, keepNext: false }
  const offsets = measuredPageBreaks(paragraph(1, 936, 80, properties), page)
  expect(offsets.map((offset) => offset.pos)).toEqual([1, 37, 73])
})

it("keeps a paragraph with two lines of the next paragraph", () => {
  const properties = { widowOrphan: true, keepTogether: false, keepNext: true }
  const units = [...paragraph(1, 888, 2, properties), ...paragraph(3, 936, 6)]
  expect(measuredPageBreaks(units, page)[0]?.pos).toBe(1)
})

it("keeps a chain of paragraphs with the following text", () => {
  const properties = { widowOrphan: true, keepTogether: false, keepNext: true }
  const units = [
    ...paragraph(1, 840, 2, properties),
    ...paragraph(3, 888, 2, properties),
    ...paragraph(5, 936, 6),
  ]
  expect(measuredPageBreaks(units, page)[0]?.pos).toBe(1)
})

it("lets a manual page break override keep-with-next", () => {
  const properties = { widowOrphan: true, keepTogether: false, keepNext: true }
  const units = [
    ...paragraph(1, 888, 2, properties),
    unit(3, 936, 936, "break"),
    ...paragraph(4, 936, 6),
  ]
  expect(measuredPageBreaks(units, page)[0]?.pos).toBe(3)
})
