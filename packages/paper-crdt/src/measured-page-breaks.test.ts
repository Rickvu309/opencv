import { expect, it } from "vitest"
import { measuredPageBreaks, type LayoutUnit } from "./measured-page-breaks.js"

const page = { height: 1056, top: 96, bottom: 96, gap: 24 }
const unit = (
  pos: number,
  top: number,
  bottom: number,
  kind: LayoutUnit["kind"] = "line",
  keepWithNext = false
): LayoutUnit => ({ pos, end: pos + 1, top, bottom, kind, keepWithNext })

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
