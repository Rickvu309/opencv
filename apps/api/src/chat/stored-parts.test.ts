import { expect, it } from "vitest"
import {
  readChatViewParts,
  readExportedParts,
  readStoredParts,
  UNREADABLE_STEP_LINE,
} from "./stored-parts.js"

const old = {
  type: "tool",
  name: "paper.edit",
  summary: "Action was not approved",
  ok: false,
}

it("reads old tool outcomes without mistaking denial or unknown data for a failure", () => {
  expect(readChatViewParts([old])).toMatchObject([
    { outcome: "denied", approval: "denied" },
  ])
  expect(
    readChatViewParts([{ ...old, summary: "Saved", ok: true }])
  ).toMatchObject([{ outcome: "approved" }])
  expect(readChatViewParts([{ ...old, summary: "Failed" }])).toMatchObject([
    { outcome: "failed" },
  ])
  expect(readChatViewParts([{ ...old, approval: "pending" }])).toMatchObject([
    { outcome: "waiting" },
  ])
})

it("keeps a part it cannot read as one plain line in the chat and as its raw value in the export", () => {
  const unknownOutcome = {
    ...old,
    outcome: "surprise",
    approval: "approved",
    pendingActionId: "proposal",
    ok: true,
  }
  const stored = [{ type: "text", text: "Hello" }, unknownOutcome, 7]
  expect(readStoredParts(stored)).toEqual([
    { readable: true, part: { type: "text", text: "Hello" } },
    { readable: false, raw: unknownOutcome },
    { readable: false, raw: 7 },
  ])
  expect(readChatViewParts(stored)).toEqual([
    { type: "text", text: "Hello" },
    { type: "text", text: UNREADABLE_STEP_LINE },
    { type: "text", text: UNREADABLE_STEP_LINE },
  ])
  expect(readExportedParts(stored)).toEqual([
    { type: "text", text: "Hello" },
    unknownOutcome,
    7,
  ])
})

it.each([
  { outcome: "approved", ok: true, approval: undefined },
  { outcome: "denied", ok: false, approval: "denied" },
  { outcome: "expired", ok: false, approval: "expired" },
  { outcome: "undone", ok: true, approval: undefined },
  { outcome: "stopped", ok: false, approval: "stopped" },
] as const)(
  "a saved $outcome step reads back as $outcome in the chat and the export",
  ({ outcome, ok, approval }) => {
    const saved = JSON.parse(
      JSON.stringify([{ ...old, summary: "Saved step", ok, outcome }])
    )
    const expected = {
      type: "tool",
      outcome,
      ...(approval ? { approval } : {}),
      ...(outcome === "undone" ? { undone: true } : {}),
    }
    expect(readChatViewParts(saved)).toMatchObject([expected])
    expect(readExportedParts(saved)).toMatchObject([expected])
  }
)

it("keeps an old saved expired step reading as expired", () => {
  expect(
    readChatViewParts([
      { ...old, summary: "Expired · ask Coach again", approval: "expired" },
    ])
  ).toMatchObject([{ outcome: "expired", approval: "expired" }])
})

it("never reads an unknown saved outcome as a step that can be approved", () => {
  expect(
    readChatViewParts([{ ...old, outcome: "paused", approval: "pending" }])
  ).toEqual([{ type: "text", text: UNREADABLE_STEP_LINE }])
})
