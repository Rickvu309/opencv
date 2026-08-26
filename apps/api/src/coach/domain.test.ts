import {
  appendCoachPart,
  COACH_SSE_EVENTS,
  COACH_SSE_HEARTBEAT_MS,
  COACH_HISTORY_CHAR_BUDGET,
  COACH_HISTORY_MESSAGE_CAP,
  COACH_STEP_CAP,
  COACH_WORKSPACE_LIST_CAP,
  DEFAULT_COACH_DAILY_TURN_LIMIT,
  DEFAULT_COACH_DAILY_TURN_LIMITS,
  DEFAULT_COACH_MAX_OUTPUT_TOKENS,
  DEFAULT_COACH_MODEL,
  DEFAULT_COACH_MODEL_FREE,
  DEFAULT_COACH_MODEL_LIGHT,
  DEFAULT_COACH_MODEL_MAX,
  DEFAULT_COACH_MODE,
  coachModeSchema,
  coachProviderErrorMessage,
  resolveCoachDailyTurnLimit,
  resolveCoachModel,
  ERROR_CODES,
  coachFeedbackInputSchema,
  coachLimitReachedEnvelope,
  coachUnavailableEnvelope,
  httpStatusForError,
  textFromParts,
  type CoachRuntime,
  type CoachStreamPart,
  type ThreadMessagePart,
} from "@workspace/domain"
import { describe, expect, it } from "vitest"

describe("coach domain exports", () => {
  it("exports unavailable and limit-reached codes with the documented statuses", () => {
    expect(ERROR_CODES.COACH_UNAVAILABLE).toBe("COACH_UNAVAILABLE")
    expect(ERROR_CODES.COACH_LIMIT_REACHED).toBe("COACH_LIMIT_REACHED")
    expect(httpStatusForError(ERROR_CODES.COACH_UNAVAILABLE)).toBe(503)
    expect(httpStatusForError(ERROR_CODES.COACH_LIMIT_REACHED)).toBe(429)
    expect(coachUnavailableEnvelope()).toEqual({
      ok: false,
      error: {
        code: "COACH_UNAVAILABLE",
        message: "The Coach is unavailable right now",
      },
    })
    expect(coachLimitReachedEnvelope()).toEqual({
      ok: false,
      error: {
        code: "COACH_LIMIT_REACHED",
        message: "You've reached today's Coach turn limit",
      },
    })
  })

  it("exports the runtime port, stream-part tags, and SSE event names", () => {
    expect(DEFAULT_COACH_MODEL).toBe("anthropic/claude-sonnet-4.5")
    expect(DEFAULT_COACH_MODE).toBe("free")
    expect(DEFAULT_COACH_DAILY_TURN_LIMIT).toBe(50)
    expect(DEFAULT_COACH_MODEL_FREE).toBe("stealth/ox-alpha")
    expect(DEFAULT_COACH_MODEL_LIGHT).toBe("deepseek/deepseek-chat-v3.1")
    expect(DEFAULT_COACH_MODEL_MAX).toBe("anthropic/claude-opus-4")
    expect(COACH_SSE_HEARTBEAT_MS).toBe(15_000)
    expect(COACH_STEP_CAP).toBe(8)
    expect(DEFAULT_COACH_MAX_OUTPUT_TOKENS).toBe(4096)
    expect(COACH_HISTORY_MESSAGE_CAP).toBe(40)
    expect(COACH_HISTORY_CHAR_BUDGET).toBe(16_000)
    expect(COACH_WORKSPACE_LIST_CAP).toBe(8)
    expect(Object.values(COACH_SSE_EVENTS)).toEqual([
      "message-start",
      "text-delta",
      "tool-call",
      "tool-result",
      "message-end",
      "error",
    ])

    const parts: CoachStreamPart[] = [
      { type: "text-delta", text: "Hi" },
      {
        type: "tool-call",
        toolCallId: "t1",
        name: "apply_moveCard",
        input: {},
      },
      {
        type: "tool-result",
        toolCallId: "t1",
        name: "apply_moveCard",
        summary: "Moved",
        ok: true,
        result: { ok: true, data: { id: "c1" } },
      },
      {
        type: "finish",
        finishReason: "stop",
        usage: { model: DEFAULT_COACH_MODEL, tokens: 20 },
      },
    ]
    expect(parts.map((part) => part.type)).toEqual([
      "text-delta",
      "tool-call",
      "tool-result",
      "finish",
    ])

    const runtime: CoachRuntime = {
      async *streamTurn() {
        yield { type: "text-delta", text: "ok" }
      },
      async generateTitle() {
        return "Plan the week"
      },
    }
    expect(typeof runtime.streamTurn).toBe("function")
    expect(typeof runtime.generateTitle).toBe("function")
  })

  it("accepts only up or down on the feedback payload", () => {
    expect(coachFeedbackInputSchema.parse({ rating: "up" })).toEqual({
      rating: "up",
    })
    expect(coachFeedbackInputSchema.parse({ rating: "down" })).toEqual({
      rating: "down",
    })
    expect(coachFeedbackInputSchema.safeParse({ rating: "meh" }).success).toBe(
      false
    )
    expect(coachFeedbackInputSchema.safeParse({}).success).toBe(false)
  })

  it("merges text deltas and records tool receipts in order", () => {
    const parts: ThreadMessagePart[] = []
    const afterText = appendCoachPart(parts, {
      type: "text-delta",
      text: "Moved it. ",
    })
    const afterCall = appendCoachPart(afterText, {
      type: "tool-call",
      toolCallId: "t1",
      name: "apply_moveCard",
      input: {},
    })
    const afterResult = appendCoachPart(afterCall, {
      type: "tool-result",
      toolCallId: "t1",
      name: "apply_moveCard",
      summary: "Moved 'Backend Intern' to Prep",
      ok: true,
      reversal: {
        possible: true,
        description: "Undo by moving the card back.",
        command: "apply.moveCard",
      },
      result: { ok: true, data: { id: "c1" } },
    })
    const afterMore = appendCoachPart(afterResult, {
      type: "text-delta",
      text: "That's the one next step.",
    })

    expect(afterCall).toEqual(afterText)
    expect(afterMore).toEqual([
      { type: "text", text: "Moved it. " },
      {
        type: "tool",
        name: "apply_moveCard",
        summary: "Moved 'Backend Intern' to Prep",
        ok: true,
        reversal: {
          possible: true,
          description: "Undo by moving the card back.",
          command: "apply.moveCard",
        },
        toolCallId: "t1",
      },
      { type: "text", text: "That's the one next step." },
    ])
    expect(textFromParts(afterMore)).toBe("Moved it. That's the one next step.")
  })
})

describe("resolveCoachModel", () => {
  it("maps each mode to its default OpenRouter id", () => {
    expect(resolveCoachModel("free")).toBe(DEFAULT_COACH_MODEL_FREE)
    expect(resolveCoachModel("light")).toBe(DEFAULT_COACH_MODEL_LIGHT)
    expect(resolveCoachModel("max")).toBe(DEFAULT_COACH_MODEL_MAX)
  })

  it("honors per-mode env overrides and ignores blank values", () => {
    const env = {
      COACH_MODEL_FREE: "  stealth/custom-free  ",
      COACH_MODEL_LIGHT: "deepseek/deepseek-chat",
      COACH_MODEL_MAX: "anthropic/claude-fable-5",
    }
    expect(resolveCoachModel("free", env)).toBe("stealth/custom-free")
    expect(resolveCoachModel("light", env)).toBe("deepseek/deepseek-chat")
    expect(resolveCoachModel("max", env)).toBe("anthropic/claude-fable-5")
    expect(
      resolveCoachModel("max", { COACH_MODEL_MAX: "   " })
    ).toBe(DEFAULT_COACH_MODEL_MAX)
  })

  it("uses deprecated COACH_MODEL only when mode is unset", () => {
    expect(resolveCoachModel(undefined, { COACH_MODEL: "openai/gpt-5" })).toBe(
      "openai/gpt-5"
    )
    expect(resolveCoachModel("free", { COACH_MODEL: "openai/gpt-5" })).toBe(
      DEFAULT_COACH_MODEL_FREE
    )
    expect(resolveCoachModel(undefined, {})).toBe(DEFAULT_COACH_MODEL)
  })

  it("rejects invalid modes at the schema", () => {
    expect(coachModeSchema.safeParse("free").success).toBe(true)
    expect(coachModeSchema.safeParse("ultra").success).toBe(false)
  })
})

describe("resolveCoachDailyTurnLimit", () => {
  it("uses mode defaults when env is unset", () => {
    expect(resolveCoachDailyTurnLimit("free")).toBe(
      DEFAULT_COACH_DAILY_TURN_LIMITS.free
    )
    expect(resolveCoachDailyTurnLimit("light")).toBe(
      DEFAULT_COACH_DAILY_TURN_LIMITS.light
    )
    expect(resolveCoachDailyTurnLimit("max")).toBe(
      DEFAULT_COACH_DAILY_TURN_LIMITS.max
    )
  })

  it("falls back to the legacy global cap when the mode-specific var is unset", () => {
    expect(
      resolveCoachDailyTurnLimit("max", { COACH_DAILY_TURN_LIMIT: "7" })
    ).toBe(7)
    expect(
      resolveCoachDailyTurnLimit("max", {
        COACH_DAILY_TURN_LIMIT: "7",
        COACH_DAILY_TURN_LIMIT_MAX: "3",
      })
    ).toBe(3)
  })
})

describe("coachProviderErrorMessage", () => {
  it("suggests Light mode on free-tier 402/429", () => {
    expect(coachProviderErrorMessage({ statusCode: 402 }, "free")).toMatch(
      /Try Light mode/
    )
    expect(coachProviderErrorMessage(new Error("429 Too Many Requests"), "free")).toMatch(
      /Try Light mode/
    )
    expect(coachProviderErrorMessage({ status: 429 }, "max")).toMatch(
      /switch modes/
    )
  })
})
