import {
  APPLY_CARD_ID_MISSING_COPY,
  applyMoveCardInputSchema,
  ERROR_CODES,
  INVALID_CARD_ID_COPY,
  PITCH_SCOPED_NO_APPLY_COPY,
  INVALID_COMMAND_INPUT_COPY,
} from "@workspace/domain"
import { describe, expect, it } from "vitest"

import { commandRegistry } from "../commands/index.js"
import {
  envelopeFromToolOutput,
  receiptDetailForTool,
  reversalForTool,
  summarizeToolResult,
} from "./receipts.js"

const INVENTED_CARD_ID = "00000000-0000-0000-0000-000000000002"

const AI_SDK_MOVE_CARD_DUMP = `Invalid input for tool apply_moveCard: Type validation failed: Value: {"cardId":"${INVENTED_CARD_ID}","stage":"prep"}.
Error message: [{"code":"invalid_format","format":"uuid","pattern":"/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/","path":["cardId"],"message":"Invalid UUID"}]`

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

  it("humanizes a failed apply.moveCard with a bad or invented card id", () => {
    const parsed = applyMoveCardInputSchema.safeParse({
      cardId: INVENTED_CARD_ID,
      stage: "prep",
    })
    expect(parsed.success).toBe(false)
    const zodIssue = parsed.success
      ? ""
      : (parsed.error.issues[0]?.message ?? "")
    const zodDump = parsed.success ? "" : parsed.error.message

    expect(zodIssue.length).toBeGreaterThan(0)
    expect(zodDump).toMatch(/invalid_format|pattern/)

    const fromZod = summarizeToolResult("apply_moveCard", {
      ok: false,
      error: { code: ERROR_CODES.VALIDATION_ERROR, message: zodIssue },
    })
    const fromZodDump = summarizeToolResult("apply_moveCard", {
      ok: false,
      error: { code: ERROR_CODES.VALIDATION_ERROR, message: zodDump },
    })
    const fromDump = summarizeToolResult("apply_moveCard", {
      ok: false,
      error: {
        code: ERROR_CODES.VALIDATION_ERROR,
        message: AI_SDK_MOVE_CARD_DUMP,
      },
    })

    expect(fromZod).toBe(INVALID_CARD_ID_COPY)
    expect(fromZodDump).toBe(INVALID_CARD_ID_COPY)
    expect(fromDump).toBe(INVALID_CARD_ID_COPY)

    expect(
      summarizeToolResult("apply_moveCard", {
        ok: false,
        error: {
          code: ERROR_CODES.VALIDATION_ERROR,
          message: APPLY_CARD_ID_MISSING_COPY,
        },
      })
    ).toBe(APPLY_CARD_ID_MISSING_COPY)
    expect(
      summarizeToolResult("apply_moveCard", {
        ok: false,
        error: {
          code: ERROR_CODES.VALIDATION_ERROR,
          message: PITCH_SCOPED_NO_APPLY_COPY,
        },
      })
    ).toBe(PITCH_SCOPED_NO_APPLY_COPY)
    for (const summary of [fromZod, fromZodDump, fromDump]) {
      expect(summary).not.toMatch(/Invalid input for tool/i)
      expect(summary).not.toMatch(/Type validation failed/i)
      expect(summary).not.toMatch(/invalid_format|Invalid UUID/i)
      expect(summary).not.toContain("{")
      expect(summary).not.toContain("[")
      expect(summary).not.toMatch(/\/\^|\\d\{/)
    }
  })

  it("humanizes a generic Zod dump without rewriting a plain Command error", () => {
    expect(
      summarizeToolResult("paper_renameDoc", {
        ok: false,
        error: {
          code: ERROR_CODES.VALIDATION_ERROR,
          message:
            'Invalid input for tool paper_renameDoc: Type validation failed: [{"code":"too_small"}]',
        },
      })
    ).toBe(INVALID_COMMAND_INPUT_COPY)

    expect(
      summarizeToolResult("paper_renameDoc", {
        ok: false,
        error: { code: ERROR_CODES.NOT_FOUND, message: "Paper doc not found" },
      })
    ).toBe("Paper doc not found")
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

describe("receiptDetailForTool", () => {
  it("builds rich payloads for the three graduated Commands", () => {
    expect(
      receiptDetailForTool(
        "paper_updateContent",
        {
          ok: true,
          data: {
            name: "PM track CV",
            kind: "cv",
            status: "draft",
            content: {
              templateId: "internship",
              name: "Minh",
              headline: "APM intern",
              contact: { email: "", phone: "", location: "" },
              summary: "After",
              experience: [],
              education: [],
              skills: [],
            },
          },
        },
        {
          possible: true,
          description: "Undo",
          input: {
            content: {
              templateId: "internship",
              name: "Minh",
              headline: "APM intern",
              contact: { email: "", phone: "", location: "" },
              summary: "Before",
              experience: [],
              education: [],
              skills: [],
            },
          },
        }
      )
    ).toEqual({
      type: "paper.updateContent",
      docKind: "cv",
      docName: "PM track CV",
      hunks: [
        {
          section: "Summary",
          sectionId: "summary",
          lines: [
            { kind: "del", text: "Before" },
            { kind: "add", text: "After" },
          ],
        },
      ],
    })

    expect(
      receiptDetailForTool(
        "apply_moveCard",
        {
          ok: true,
          data: {
            title: "Associate PM intern",
            company: "Local startup",
            stage: "prep",
          },
        },
        { possible: true, description: "Undo", input: { stage: "inbox" } }
      )
    ).toEqual({
      type: "apply.moveCard",
      title: "Associate PM intern",
      company: "Local startup",
      from: "inbox",
      to: "prep",
    })

    expect(
      receiptDetailForTool("paper_createDoc", {
        ok: true,
        data: { name: "Untitled CV", kind: "cv", status: "draft" },
      })
    ).toEqual({
      type: "paper.createDoc",
      docKind: "cv",
      name: "Untitled CV",
      status: "draft",
    })
  })

  it("stays generic for same-Stage moves, empty diffs, and failures", () => {
    expect(
      receiptDetailForTool(
        "apply_moveCard",
        {
          ok: true,
          data: {
            title: "Associate PM intern",
            company: "Local startup",
            stage: "prep",
          },
        },
        { possible: true, description: "Undo", input: { stage: "prep" } }
      )
    ).toBeUndefined()
    expect(
      receiptDetailForTool(
        "paper_updateContent",
        {
          ok: true,
          data: {
            name: "PM track CV",
            kind: "cv",
            status: "draft",
            content: {
              templateId: "internship",
              name: "",
              headline: "",
              contact: { email: "", phone: "", location: "" },
              summary: "Same",
              experience: [],
              education: [],
              skills: [],
            },
          },
        },
        {
          possible: true,
          description: "Undo",
          input: {
            content: {
              templateId: "internship",
              name: "",
              headline: "",
              contact: { email: "", phone: "", location: "" },
              summary: "Same",
              experience: [],
              education: [],
              skills: [],
            },
          },
        }
      )
    ).toBeUndefined()
    expect(
      receiptDetailForTool("paper_createDoc", {
        ok: false,
        error: { code: ERROR_CODES.VALIDATION_ERROR, message: "Name is required" },
      })
    ).toBeUndefined()
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
