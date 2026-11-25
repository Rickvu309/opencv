import assert from "node:assert/strict"
import test from "node:test"
import { detectPaperEditApproval as detect } from "./lib/paper-coach-proposal.mjs"

const approvalMistake = `
const contract = {
  "paper.edit": commandEntry({
    coach: "auto",
    destructive: false,
  }),
}
`

const approvalClean = `
const contract = {
  "paper.edit": commandEntry({
    coach: "confirm",
    destructive: false,
  }),
}
`

test("paper.edit approval guard fires on auto and stays quiet on confirm", () => {
  assert.equal(detect(approvalMistake).length, 1)
  assert.equal(detect(approvalClean).length, 0)
})
