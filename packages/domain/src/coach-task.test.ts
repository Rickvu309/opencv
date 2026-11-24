import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { it } from "node:test"
import {
  coachStartInputSchema,
  coachTaskEventsInputSchema,
  coachTaskReplaySchema,
} from "./coach-task.ts"

const coachTaskCursorSchema = coachTaskEventsInputSchema.shape.after

it("requires a stable start key and preserves the Send and Regenerate validation", () => {
  const base = { chatId: randomUUID(), startKey: randomUUID() }
  assert.equal(coachStartInputSchema.safeParse(base).success, false)
  assert.equal(
    coachStartInputSchema.safeParse({ ...base, text: "Prepare" }).success,
    true
  )
  assert.equal(
    coachStartInputSchema.safeParse({ ...base, regenerate: true }).success,
    true
  )
  assert.equal(
    coachStartInputSchema.safeParse({ ...base, startKey: "", text: "Prepare" })
      .success,
    false
  )
  assert.equal(
    coachStartInputSchema.safeParse({
      ...base,
      regenerate: true,
      toolsAllowed: true,
    }).success,
    false
  )
})

it("accepts only safe integer cursors and discriminates replay from reset", () => {
  for (const invalid of [-2, 1.5, Infinity, Number.MAX_SAFE_INTEGER + 1])
    assert.equal(coachTaskCursorSchema.safeParse(invalid).success, false)
  for (const valid of [-1, 0, Number.MAX_SAFE_INTEGER])
    assert.equal(coachTaskCursorSchema.parse(valid), valid)
  assert.deepEqual(
    coachTaskReplaySchema.parse({
      type: "events",
      events: [],
      cursor: -1,
      terminal: false,
    }),
    { type: "events", events: [], cursor: -1, terminal: false }
  )
  assert.equal(
    coachTaskReplaySchema.safeParse({ type: "reset", reason: "expired" })
      .success,
    false
  )
})
