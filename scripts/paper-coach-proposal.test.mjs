import assert from "node:assert/strict"
import test from "node:test"
import {
  detectPaperEditApproval as detect,
  detectStalePaperBasis,
} from "./lib/paper-coach-proposal.mjs"

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

const basisMistake = `
export function stalePaperBasis(basedOn: number, revision: number) {
  if (basedOn === revision) return "apply" as const
  return "apply" as const
}
function checked(proposal: boolean, basedOn: number, revision: number) {
  if (proposal && stalePaperBasis(basedOn, revision) === "refuse") {
    throw new Error("stale")
  }
}
`

const basisClean = `
export function stalePaperBasis(basedOn: number, revision: number) {
  if (basedOn === revision) return "apply" as const
  return "refuse" as const
}
function checked(proposal: boolean, basedOn: number, revision: number) {
  if (proposal && stalePaperBasis(basedOn, revision) === "refuse") {
    throw new Error("stale")
  }
}
`

test("paper.edit approval guard fires on auto and stays quiet on confirm", () => {
  assert.equal(detect(approvalMistake).length, 1)
  assert.equal(detect(approvalClean).length, 0)
})

test("stale basis guard fires when refusal is missing and stays quiet when it is returned", () => {
  assert.equal(detectStalePaperBasis(basisMistake).length, 1)
  assert.equal(detectStalePaperBasis(basisClean).length, 0)
})
