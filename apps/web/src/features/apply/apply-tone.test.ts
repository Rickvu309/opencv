import { describe, expect, it } from "vitest"

import { FAINT_TEXT } from "./apply-tone.ts"

describe("Apply faint text tones", () => {
  it("pins each tertiary grey to an AA-safe opacity at 4.5:1 contrast", () => {
    expect(FAINT_TEXT).toEqual({
      card: "text-muted-foreground/94",
      background: "text-muted-foreground/96",
      secondary: "text-muted-foreground/98",
    })
  })
})
