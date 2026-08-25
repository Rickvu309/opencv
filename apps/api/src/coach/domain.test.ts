import {
  COACH_SSE_EVENTS,
  DEFAULT_COACH_DAILY_TURN_LIMIT,
  DEFAULT_COACH_MODEL,
  ERROR_CODES,
  coachLimitReachedEnvelope,
  coachUnavailableEnvelope,
  httpStatusForError,
  type CoachRuntime,
  type CoachStreamPart,
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
    expect(DEFAULT_COACH_DAILY_TURN_LIMIT).toBe(50)
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
    }
    expect(typeof runtime.streamTurn).toBe("function")
  })
})
