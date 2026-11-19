import { describe, expect, it } from "vitest"

import { personInitials } from "@/lib/person-initials.ts"

describe("initials for every avatar", () => {
  it("uses the saved name when there is one", () => {
    expect(personInitials("Ada Lovelace", "ada@example.com")).toBe("AL")
  })

  it("uses the first letter of the email when no name is saved", () => {
    expect(personInitials("  ", "ui-agent@example.com")).toBe("U")
  })
})
