import { describe, expect, it } from "vitest"

import type { ChatViewMessage } from "@/features/coach/chat-messages.ts"

import {
  turnPhase,
  turnReducer,
  type SendError,
  type TurnState,
} from "./turn-state.ts"

const idle: TurnState = { status: "idle", messages: null }
const user: ChatViewMessage = { id: "u1", role: "user", text: "hello" }
const partial: ChatViewMessage = {
  id: "streaming-coach",
  role: "coach",
  text: "I looked",
}
const error: SendError = {
  message: "Couldn't reach the Coach. Check your connection and try again.",
  userMessageId: "u1",
  text: "hello",
  local: true,
}

function streaming(): TurnState {
  return turnReducer(idle, { type: "start", kind: "send", messages: [user] })
}

describe("turnReducer", () => {
  it("moves idle to a waiting stream on start", () => {
    expect(streaming()).toEqual({
      status: "streaming",
      kind: "send",
      messages: [user],
      waiting: true,
    })
    expect(turnPhase(streaming())).toBe("waiting")
  })

  it("clears waiting on the first delta", () => {
    const next = turnReducer(streaming(), {
      type: "delta",
      messages: [user, partial],
    })
    expect(next).toEqual({
      status: "streaming",
      kind: "send",
      messages: [user, partial],
      waiting: false,
    })
    expect(turnPhase(next)).toBe("streaming")
  })

  it("returns to idle with the final messages on finish", () => {
    expect(
      turnReducer(streaming(), { type: "finish", messages: [user, partial] })
    ).toEqual({ status: "idle", messages: [user, partial] })
    expect(
      turnReducer(streaming(), { type: "finish", messages: null })
    ).toEqual(idle)
  })

  it("keeps the mapped message in error on fail and reports idle", () => {
    const next = turnReducer(streaming(), { type: "fail", error })
    expect(next).toEqual({
      status: "error",
      kind: "send",
      messages: [user],
      error,
    })
    expect(turnPhase(next)).toBe("idle")
  })

  it("yields aborted with the kept messages on abort", () => {
    const next = turnReducer(streaming(), {
      type: "abort",
      messages: [user, partial],
    })
    expect(next).toEqual({ status: "aborted", messages: [user, partial] })
    expect(turnPhase(next)).toBe("idle")
  })

  it("returns to idle on reset from any state", () => {
    const failed = turnReducer(streaming(), { type: "fail", error })
    expect(turnReducer(failed, { type: "reset" })).toEqual(idle)
    expect(turnReducer(streaming(), { type: "reset" })).toEqual(idle)
  })

  it("ignores a delta after abort", () => {
    const aborted = turnReducer(streaming(), {
      type: "abort",
      messages: [user],
    })
    expect(
      turnReducer(aborted, { type: "delta", messages: [user, partial] })
    ).toBe(aborted)
  })

  it("starts a new turn from error and aborted states", () => {
    const failed = turnReducer(streaming(), { type: "fail", error })
    expect(
      turnReducer(failed, { type: "start", kind: "regenerate", messages: [] })
    ).toEqual({
      status: "streaming",
      kind: "regenerate",
      messages: [],
      waiting: true,
    })
  })
})
