import { expect, it } from "vitest"
import { readStoredParts } from "./stored-parts.js"

it("reads old tool outcomes without mistaking denial or unknown data for a failure", () => {
  const old = {
    type: "tool",
    name: "paper.edit",
    summary: "Action was not approved",
    ok: false,
  }
  expect(readStoredParts([old])).toMatchObject([
    { outcome: "denied", approval: "denied" },
  ])
  expect(readStoredParts([{ ...old, outcome: "surprise" }])).toEqual([])
  expect(
    readStoredParts([{ ...old, summary: "Saved", ok: true }])
  ).toMatchObject([{ outcome: "approved" }])
  expect(readStoredParts([{ ...old, summary: "Failed" }])).toMatchObject([
    { outcome: "failed" },
  ])
  expect(readStoredParts([{ ...old, approval: "pending" }])).toMatchObject([
    { outcome: "waiting" },
  ])
})
