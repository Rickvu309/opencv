import { describe, expect, it } from "vitest"
import { parsePointValue, pointValueProblem } from "./rich-text-point-value.ts"

describe("Paper point values", () => {
  it.each([
    ["10.5", 10.5],
    ["10,5", 10.5],
    [" 12 ", 12],
    ["0,05", 0.05],
  ])("reads %s as %s", (text, value) => {
    expect(parsePointValue(text)).toBe(value)
  })

  it.each(["", "1e1", "10,5,0", "1.000,5", "-2", "abc", "10.", ",5"])(
    "refuses %j instead of guessing",
    (text) => {
      expect(parsePointValue(text)).toBeNull()
    }
  )

  it("never reads a decimal comma as a thousands separator", () => {
    expect(parsePointValue("10,5")).not.toBe(105)
    expect(pointValueProblem("10,5", { min: 4, max: 144, step: 0.5 })).toBe("")
    expect(pointValueProblem("10,25", { min: 4, max: 144, step: 0.5 })).toMatch(
      /half points/
    )
    expect(pointValueProblem("1,000", { min: 4, max: 144, step: 0.5 })).toMatch(
      /from 4 to 144/
    )
    expect(pointValueProblem("6,15", { min: 0, max: 1584, step: 0.05 })).toBe(
      ""
    )
  })
})
