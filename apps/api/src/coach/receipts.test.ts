import { ERROR_CODES } from "@workspace/domain"
import { describe, expect, it } from "vitest"

import { commandRegistry } from "../commands/index.js"
import {
  envelopeFromToolOutput,
  reversalForTool,
  summarizeToolResult,
} from "./receipts.js"

describe("summarizeToolResult", () => {
  it("is truthful on success and failure", () => {
    expect(
      summarizeToolResult("apply_moveCard", {
        ok: true,
        data: {
          title: "Associate PM intern",
          company: "Local startup",
          stage: "prep",
        },
      })
    ).toBe("Moved Associate PM intern at Local startup to Prep")

    expect(
      summarizeToolResult("apply_moveCard", {
        ok: false,
        error: { code: ERROR_CODES.NOT_FOUND, message: "Apply card not found" },
      })
    ).toBe("Apply card not found")

    expect(
      summarizeToolResult("apply_listCards", { ok: true, data: [{}, {}] })
    ).toBe("Listed 2 Apply cards")
  })
})

describe("reversalForTool", () => {
  it("uses the Command reversal for mutations and a read note for reads", () => {
    expect(reversalForTool("apply_moveCard", commandRegistry)).toEqual({
      possible: true,
      command: "apply.moveCard",
      description: "Undo by moving the card back to its previous Stage and order.",
    })
    expect(reversalForTool("apply_listCards", commandRegistry)).toEqual({
      possible: false,
      description: "This read does not change anything.",
    })
  })
})

describe("envelopeFromToolOutput", () => {
  it("passes through envelopes and wraps unknown output", () => {
    expect(envelopeFromToolOutput({ ok: true, data: { id: "1" } })).toEqual({
      ok: true,
      data: { id: "1" },
    })
    expect(envelopeFromToolOutput("nope")).toEqual({
      ok: false,
      error: {
        code: ERROR_CODES.VALIDATION_ERROR,
        message: "Tool returned an unexpected result",
      },
    })
  })
})
