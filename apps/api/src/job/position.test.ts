import { generateKeyBetween } from "@workspace/domain/apply"
import { describe, expect, it } from "vitest"

describe("generateKeyBetween", () => {
  it("starts in the middle of the alphabet when both sides are open", () => {
    expect(generateKeyBetween(null, null)).toBe("a0")
  })

  it("keeps appends, prepends, and mid-inserts strictly ordered", () => {
    let end = generateKeyBetween(null, null)
    const appended = [end]
    for (let i = 0; i < 20; i++) {
      end = generateKeyBetween(end, null)
      appended.push(end)
    }
    expect(appended).toEqual([...appended].sort())

    let start = generateKeyBetween(null, null)
    const prepended = [start]
    for (let i = 0; i < 20; i++) {
      start = generateKeyBetween(null, start)
      prepended.unshift(start)
    }
    expect(prepended).toEqual([...prepended].sort())

    const first = generateKeyBetween(null, null)
    const last = generateKeyBetween(first, null)
    const middle = [first, last]
    for (let i = 0; i < 20; i++) {
      const next = generateKeyBetween(middle[0]!, middle[1]!)
      middle.splice(1, 0, next)
    }
    expect(middle).toEqual([...middle].sort())
    expect(new Set(middle).size).toBe(middle.length)
  })

  it("rejects inverted bounds", () => {
    expect(() => generateKeyBetween("b", "a")).toThrow(/less than/)
  })
})
