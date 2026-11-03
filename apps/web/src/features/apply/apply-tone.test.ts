import { describe, expect, it } from "vitest"

import { FAINT_TEXT } from "./apply-tone.ts"

describe("Apply faint text tones", () => {
  it("pins each pen tertiary grey to the AA-safe opacity that verify-pen-layout checks at 4.5:1 contrast", () => {
    expect(FAINT_TEXT).toEqual({
      card: "text-muted-foreground/84",
      background: "text-muted-foreground/86",
      secondary: "text-muted-foreground/88",
    })
  })
})
