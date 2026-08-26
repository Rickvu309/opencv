import { describe, expect, it } from "vitest"

import { STUB_PAPER_COACH_REPLY } from "./paper-ai-chat.tsx"

describe("Paper Coach stub", () => {
  it("does not claim a document edit or Command", () => {
    expect(STUB_PAPER_COACH_REPLY).toMatch(/haven't edited this document/i)
    expect(STUB_PAPER_COACH_REPLY).toMatch(/run any Commands/i)
    expect(STUB_PAPER_COACH_REPLY).toMatch(/lives on Home/i)
    expect(STUB_PAPER_COACH_REPLY).not.toMatch(
      /\bI (have|'ve|just) (edited|updated|ran|added|rewrote)\b/i
    )
  })
})
