import { describe, expect, it } from "vitest"

import { paragraphsOf, readStoredLetter } from "./letter-sheet-model.ts"

describe("letter sheet model", () => {
  it("splits a body on a blank line only", () => {
    expect(paragraphsOf("One.\n\nTwo.\nStill two.")).toEqual([
      "One.",
      "Two.\nStill two.",
    ])
  })

  it("reads a stored letter as it is", () => {
    const letter = { markdown: "Hello.", sender: "Linh" }
    expect(readStoredLetter(letter)).toEqual(letter)
  })

  it("reads an old body-only value and a missing one", () => {
    expect(readStoredLetter({ markdown: "Hi" })).toEqual({ markdown: "Hi" })
    expect(readStoredLetter(null)).toEqual({ markdown: "" })
    expect(readStoredLetter({ markdown: 3 })).toEqual({ markdown: "" })
  })
})
