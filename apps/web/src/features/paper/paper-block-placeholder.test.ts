import { describe, expect, it } from "vitest"

import { blockPlaceholder } from "./paper-block-fields.tsx"
import { starterBlock } from "./paper-block-ops.ts"

describe("empty block names", () => {
  it("names an empty block for its accessible label", () => {
    expect(
      blockPlaceholder({ id: "h", type: "heading", text: "" }, "summary")
    ).toBe("Headline")
    expect(
      blockPlaceholder({ id: "t", type: "text", text: "" }, "summary")
    ).toBe("Summary")
    expect(
      blockPlaceholder(
        {
          id: "e",
          type: "experience-entry",
          role: "",
          company: "",
          period: "",
          bullets: [],
        },
        "experience"
      )
    ).toBe("Role, company")
  })

  it("shows a placeholder while a starter section has no stored blocks", () => {
    expect(starterBlock("experience", "draft-1")?.type).toBe("experience-entry")
    expect(starterBlock("education", "draft-2")?.type).toBe("education-entry")
    expect(starterBlock("skills", "draft-3")?.type).toBe("skills-group")
    expect(starterBlock("summary", "draft-4")).toBeNull()
  })
})
