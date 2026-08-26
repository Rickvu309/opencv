import { describe, expect, it } from "vitest"

import { destructiveConfirmDescription } from "@/features/commands/destructive-confirm-copy.ts"

describe("destructive confirm copy", () => {
  it("names the target and says the Command cannot be undone", () => {
    expect(destructiveConfirmDescription("PM track CV")).toBe(
      "Delete “PM track CV”? This cannot be undone."
    )
    expect(destructiveConfirmDescription(null)).toBe("This cannot be undone.")
  })
})
