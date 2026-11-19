import { describe, expect, it } from "vitest"

import {
  rulerMarks,
  rulerNumberAt,
  rulerOffset,
  rulerShown,
  rulerTicks,
} from "./paper-hand-ruler-marks.ts"

describe("paper hand number ruler", () => {
  it("shows only when the hand holds more cards than fit", () => {
    expect(rulerShown(7)).toBe(false)
    expect(rulerShown(8)).toBe(true)
  })

  it("labels round numbers and always ends on the total", () => {
    expect(rulerMarks(60, 440)).toEqual([1, 10, 20, 30, 40, 50, 60])
    expect(rulerMarks(21, 440)).toEqual([1, 5, 10, 15, 21])
    expect(rulerMarks(39, 280)).toEqual([1, 10, 20, 30, 39])
    expect(rulerMarks(500, 440)).toEqual([1, 100, 200, 300, 400, 500])
    expect(rulerMarks(12, 440)).toEqual([1, 4, 6, 8, 10, 12])
  })

  it("places numbers from the first to the last end", () => {
    expect(rulerOffset(1, 60)).toBe(0)
    expect(rulerOffset(60, 60)).toBe(100)
    expect(rulerNumberAt(0, 60)).toBe(1)
    expect(rulerNumberAt(1, 60)).toBe(60)
    expect(rulerNumberAt(1.4, 60)).toBe(60)
    expect(rulerNumberAt(0.5, 21)).toBe(11)
  })

  it("thins the ticks for very long hands", () => {
    expect(rulerTicks(60, rulerMarks(60, 440))).toHaveLength(60)
    expect(rulerTicks(500, rulerMarks(500, 440)).length).toBeLessThan(60)
  })
})
