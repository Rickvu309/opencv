import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { readdirSync, readFileSync } from "node:fs"
import test from "node:test"

import { detectCoachBlockPaper as detect } from "./lib/coach-block-paper.mjs"

const NAMES_OLD_RECEIPTS_FOR_READING = "chat/stored-parts.ts"

const mistake = `export const paperContract = commandContract({
  "paper.create": commandEntry({
    description: "Create a CV or letter.",
    coach: "auto",
    destructive: false,
  }),
})`

const clean = `export const paperContract = commandContract({
  "paper.create": commandEntry({
    description: "Create a CV or letter.",
    coach: "never",
    destructive: false,
  }),
  "paper.start": commandEntry({ coach: "confirm", destructive: false }),
})`

const coachMistake = `const intents = [{ id: "call_create", name: "paper.create", input: { kind: "cv" } }]`

const coachClean = `const intents = [{ id: "call_start", name: "paper.start", input: { kind: "cv" } }]`

test("no Coach path creates an older block document", () => {
  assert.equal(detect(mistake, "paper-contract.ts").length, 1)
  assert.equal(detect(clean, "paper-contract.ts").length, 0)
  assert.equal(detect(coachMistake, "fake.ts").length, 1)
  assert.equal(detect(coachClean, "fake.ts").length, 0)
  assert.equal(detect(`tools.find((t) => t.name === "paper_create")`).length, 1)
  const historic = execFileSync(
    "git",
    ["show", "2a4ea761:packages/domain/src/paper-contract.ts"],
    { encoding: "utf8" }
  )
  assert.equal(detect(historic, "paper-contract.ts").length, 1)
  const contract = new URL(
    "../packages/domain/src/paper-doc/paper-contract.ts",
    import.meta.url
  )
  assert.deepEqual(
    detect(readFileSync(contract, "utf8"), "paper-contract.ts"),
    []
  )
  const coach = new URL("../apps/api/src/coach/", import.meta.url)
  for (const path of readdirSync(coach, { recursive: true })) {
    if (!/\.ts$/.test(path) || /\.test\.ts$/.test(path)) continue
    if (path === NAMES_OLD_RECEIPTS_FOR_READING) continue
    assert.deepEqual(
      detect(readFileSync(new URL(path, coach), "utf8"), path),
      [],
      path
    )
  }
})
