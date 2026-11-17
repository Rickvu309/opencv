import { describe, expect, it } from "vitest"

import { personInitials, personName } from "@/lib/person-initials.ts"

describe("one name and initials for every footer", () => {
  it("uses the name when there is one", () => {
    expect(personName("Ada Lovelace", "ada@example.com")).toBe("Ada Lovelace")
    expect(personInitials("Ada Lovelace", "ada@example.com")).toBe("AL")
  })

  it("uses the email local part when the name is blank", () => {
    expect(personName("  ", "ui-agent@example.com")).toBe("ui-agent")
    expect(personInitials("", "ui-agent@example.com")).toBe("U")
  })

  it("keeps a last-resort label only when both are blank", () => {
    expect(personName("", "")).toBe("Account")
    expect(personInitials("", "")).toBe("A")
  })
})
