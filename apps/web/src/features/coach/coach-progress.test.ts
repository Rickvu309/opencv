import type { ChatEntryPart } from "@workspace/domain"
import { describe, expect, it } from "vitest"

import {
  coachProgressReducer,
  coachProgressRows,
  type CoachProgressAction,
  type CoachProgressCall,
} from "./coach-progress.ts"

function fold(actions: CoachProgressAction[]) {
  return actions.reduce<readonly CoachProgressCall[]>(coachProgressReducer, [])
}

function tool(
  toolCallId: string,
  extra: Partial<Extract<ChatEntryPart, { type: "tool" }>> = {}
): ChatEntryPart {
  return {
    type: "tool",
    name: "paper.read",
    summary: "Read",
    ok: true,
    toolCallId,
    ...extra,
  }
}

describe("coachProgressReducer", () => {
  it("joins a call to the step label emitted right before it", () => {
    const calls = fold([
      { type: "step", id: "step-1", label: "Read CV" },
      { type: "call", id: "call-1", name: "paper.read" },
    ])
    expect(calls).toEqual([
      { kind: "call", id: "call-1", name: "paper.read", label: "Read CV" },
    ])
  })

  it("keeps repeated labels as separate calls", () => {
    const calls = fold([
      { type: "step", id: "step-1", label: "Read CV" },
      { type: "call", id: "call-1", name: "paper.read" },
      { type: "step", id: "step-2", label: "Read CV" },
      { type: "call", id: "call-2", name: "paper.read" },
    ])
    expect(calls.map((call) => call.id)).toEqual(["call-1", "call-2"])
  })

  it("ignores a call it already holds", () => {
    const once = fold([{ type: "call", id: "call-1", name: "paper.read" }])
    expect(
      coachProgressReducer(once, {
        type: "call",
        id: "call-1",
        name: "paper.read",
      })
    ).toBe(once)
  })

  it("labels a call with no step in plain words", () => {
    const [call] = fold([{ type: "call", id: "call-1", name: "job.list" }])
    expect(call?.label).toBe("Look at your Jobs")
  })
})

describe("coachProgressRows", () => {
  const calls = fold([
    { type: "step", id: "step-1", label: "List documents" },
    { type: "call", id: "a", name: "paper.read" },
    { type: "step", id: "step-2", label: "List jobs" },
    { type: "call", id: "b", name: "job.list" },
  ])

  it("keeps every call running until its own result", () => {
    expect(coachProgressRows(calls, []).map((row) => row.status)).toEqual([
      "running",
      "running",
    ])
  })

  it("does not complete an earlier call because a later one finished", () => {
    expect(
      coachProgressRows(calls, [tool("b")]).map((row) => row.status)
    ).toEqual(["running", "completed"])
  })

  it("resolves out-of-order results by call id", () => {
    expect(
      coachProgressRows(calls, [tool("b"), tool("a", { ok: false })]).map(
        (row) => row.status
      )
    ).toEqual(["failed", "completed"])
  })

  it.each([
    ["pending", "approval"],
    ["denied", "declined"],
    ["expired", "declined"],
    ["stopped", "declined"],
  ] as const)("reports %s approval as %s", (approval, status) => {
    expect(coachProgressRows(calls, [tool("a", { approval })])[0]?.status).toBe(
      status
    )
  })

  it("never calls a result carrying a pending action id completed", () => {
    expect(
      coachProgressRows(calls, [tool("a", { pendingActionId: "p1" })])[0]
        ?.status
    ).toBe("approval")
  })

  it("reports a bare step without implying progress", () => {
    const bare = fold([{ type: "step", id: "step-1", label: "Thinking" }])
    expect(coachProgressRows(bare, [tool("x")])).toEqual([
      { id: "step-1", label: "Thinking", status: "reported" },
    ])
  })
})
