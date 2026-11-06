import { describe, expect, it } from "vitest"
import {
  coachTaskReducer,
  taskFromSnapshot,
  taskParts,
} from "./coach-task-state.ts"
import { taskEvent, taskSnapshot, TASK } from "@/test/coach-task-fixture.ts"

describe("durable Coach projection", () => {
  it("replays once after the snapshot cursor and ignores duplicate or foreign events", () => {
    const event = taskEvent(0, "Hello")
    let state = taskFromSnapshot(taskSnapshot({ cursor: 0, events: [event] }))
    state = coachTaskReducer(state, { type: "event", event })
    state = coachTaskReducer(state, {
      type: "event",
      event: taskEvent(1, " world"),
    })
    state = coachTaskReducer(state, {
      type: "event",
      event: taskEvent(2, "foreign", { taskId: "other" }),
    })
    expect(state.draft).toBe("Hello world")
    expect(state.cursor).toBe(1)
  })
  it("requires a snapshot on a gap and rejects a snapshot behind the consumed cursor", () => {
    const state = coachTaskReducer(
      taskFromSnapshot(taskSnapshot({ cursor: 2 })),
      { type: "event", event: taskEvent(4, "gap") }
    )
    expect(state.needsSnapshot).toBe(true)
    expect(state.cursor).toBe(2)
    expect(
      coachTaskReducer(state, {
        type: "snapshot",
        snapshot: taskSnapshot({ cursor: 1 }),
      })
    ).toBe(state)
    expect(
      coachTaskReducer(state, {
        type: "snapshot",
        snapshot: taskSnapshot({ cursor: 4 }),
      }).needsSnapshot
    ).toBe(false)
  })
  it("drops the abandoned attempt draft in both replay and live delivery", () => {
    const events = [
      taskEvent(0, "old"),
      taskEvent(1, "", { kind: "attemptRestarted", attempt: 2 }),
      taskEvent(2, "new", { attempt: 2 }),
    ]
    expect(taskFromSnapshot(taskSnapshot({ cursor: 2, events })).draft).toBe(
      "new"
    )
    let state = taskFromSnapshot(taskSnapshot())
    for (const event of events)
      state = coachTaskReducer(state, { type: "event", event })
    expect(state.draft).toBe("new")
  })
  it.each(["succeeded", "failed", "cancelled"] as const)(
    "replaces a disconnected draft with canonical %s state",
    (status) => {
      let state = taskFromSnapshot(
        taskSnapshot({ cursor: 0, events: [taskEvent(0, "draft")] })
      )
      state = coachTaskReducer(state, { type: "disconnected" })
      expect(state.reconnecting).toBe(true)
      state = coachTaskReducer(state, {
        type: "snapshot",
        snapshot: taskSnapshot({ state: status, cursor: 1 }),
      })
      expect(state.snapshot.state).toBe(status)
      expect(state.draft).toBe("")
      expect(state.reconnecting).toBe(false)
    }
  )
  it("projects one approval and replaces it with one receipt after resolution", () => {
    const action = {
      step: 0,
      slot: 0,
      toolCallId: "call",
      operation: "job.setPriority",
      input: {},
      state: "proposed" as const,
      proposalId: TASK,
      activityId: null,
      result: null,
      errorCode: null,
    }
    const confirmation = {
      id: TASK,
      command: action.operation,
      input: {},
      summary: "Set priority",
      status: "pending" as const,
    }
    let state = taskFromSnapshot(
      taskSnapshot({ actions: [action], confirmations: [confirmation] })
    )
    expect(taskParts(state)).toMatchObject([
      { pendingActionId: TASK, approval: "pending" },
    ])
    state = coachTaskReducer(state, {
      type: "snapshot",
      snapshot: taskSnapshot({
        actions: [{ ...action, state: "committed", activityId: TASK }],
        confirmations: [{ ...confirmation, status: "approved" }],
      }),
    })
    expect(taskParts(state)).toMatchObject([
      { activityId: TASK, approval: "approved" },
    ])
    expect(taskParts(state)).toHaveLength(1)
    expect(taskParts(state)[0]).not.toHaveProperty("pendingActionId")
  })
})
