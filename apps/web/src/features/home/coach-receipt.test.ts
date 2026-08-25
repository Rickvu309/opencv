import { describe, expect, it } from "vitest"

import {
  commandNameFromTool,
  receiptHeadline,
} from "@/features/home/coach-receipt.ts"

describe("receiptHeadline", () => {
  it("uses the dotted Command name and the truthful summary", () => {
    expect(commandNameFromTool("apply_moveCard")).toBe("apply.moveCard")
    expect(commandNameFromTool("apply.moveCard")).toBe("apply.moveCard")
    expect(
      receiptHeadline({
        type: "tool",
        name: "apply_moveCard",
        summary: "Moved 'Backend Intern' to Prep",
        ok: true,
      })
    ).toBe("Ran apply.moveCard — Moved 'Backend Intern' to Prep")
  })

  it("keeps failure summaries plain", () => {
    expect(
      receiptHeadline({
        type: "tool",
        name: "apply_moveCard",
        summary: "Apply card not found",
        ok: false,
      })
    ).toBe("Ran apply.moveCard — Apply card not found")
  })
})
