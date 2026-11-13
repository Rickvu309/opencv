import { describe, expect, it } from "vitest"

import { GRID, parseSize, sizeLabel } from "./viewport-grid"

describe("the window grid", () => {
  it("holds ten sizes, from the smallest phone to a wide desktop, with the 117px window where the Coach panel collapsed", () => {
    expect(GRID.map(sizeLabel)).toEqual([
      "320x568",
      "390x844",
      "390x560",
      "600x480",
      "820x512",
      "1024x700",
      "1280x400",
      "1280x117",
      "1366x657",
      "1440x900",
    ])
  })
  it("reads a size typed on the command line and refuses anything else", () => {
    expect(parseSize("390x560")).toEqual({ width: 390, height: 560 })
    expect(() => parseSize("390")).toThrow("WIDTHxHEIGHT")
  })
})
