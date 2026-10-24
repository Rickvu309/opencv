import assert from "node:assert/strict"
import { test } from "node:test"

import {
  contrastNeeded,
  contrastRatio,
  emptyActionLabels,
  hasBasisSentence,
  metricClaims,
  nounViolations,
  offTokenDurations,
  onSpacingScale,
  otherProductNames,
  showsRawMessage,
} from "./text-rules.mjs"

test("nouns: job, email, document and profile are flagged", () => {
  const found = nounViolations([
    "Add job",
    "Edit profile",
    "New document",
    "Draft a Letter",
    "Add opportunity",
    "A first full-time job",
  ])
  assert.deepEqual(
    found.map((f) => f.label),
    ["Add job", "Edit profile", "New document"]
  )
})

test("nouns: the Paper empty sentence is exempt and a near copy is not", () => {
  const found = nounViolations([
    "No documents yet. Create a CV, Letter, or Proof to start.",
    "No documents yet. Create a document to start.",
  ])
  assert.deepEqual(
    found.map((f) => f.label),
    ["No documents yet. Create a document to start."]
  )
})

test("nouns: the exemption is only for short goal chips and the connector row", () => {
  const found = nounViolations([
    "Drop a dream job here",
    "Add a summer job",
    "Paste your first job posting",
    "Connect email to send this job",
    "Connect email, optional",
    "A café or part-time job",
  ])
  assert.deepEqual(
    [...new Set(found.map((f) => f.label))],
    [
      "Drop a dream job here",
      "Add a summer job",
      "Paste your first job posting",
      "Connect email to send this job",
    ]
  )
})

test("empty action labels", () => {
  assert.deepEqual(
    emptyActionLabels(["Learn more", "More", "Add opportunity"]),
    ["Learn more"]
  )
})

test("other product names", () => {
  assert.deepEqual(otherProductNames("like Instagram Stories"), ["Instagram"])
  assert.deepEqual(otherProductNames("like Twitter"), ["Twitter"])
  assert.deepEqual(otherProductNames("Tap a highlight to play it."), [])
})

test("metric claims and basis", () => {
  assert.deepEqual(metricClaims("+18% add-to-cart taps"), [
    "18%",
    "add-to-cart",
  ])
  assert.deepEqual(metricClaims("lift 18 percent"), ["18 percent"])
  assert.deepEqual(metricClaims("Shipped a checkout redesign"), [])
  assert.equal(hasBasisSentence("82% because your CV lists React"), true)
  assert.equal(hasBasisSentence("82%"), false)
})

test("raw message", () => {
  assert.equal(
    showsRawMessage("hello User not found. Retry", "User not found."),
    true
  )
  assert.equal(
    showsRawMessage("Couldn't reach the Coach.", "User not found."),
    false
  )
})

test("durations: only 0, 150 and 280 ms pass", () => {
  assert.deepEqual(offTokenDurations("0.15s, 0.1s"), [100])
  assert.deepEqual(offTokenDurations("150ms"), [])
  assert.deepEqual(offTokenDurations("0.28s"), [])
  assert.deepEqual(offTokenDurations("0.2s"), [200])
})

test("contrast", () => {
  assert.ok(contrastRatio([0, 0, 0], [255, 255, 255]) > 20.9)
  assert.ok(contrastRatio([119, 119, 119], [255, 255, 255]) < 4.5)
  assert.equal(contrastNeeded(24, 400), 3)
  assert.equal(contrastNeeded(14, 400), 4.5)
})

test("spacing scale", () => {
  assert.equal(onSpacingScale(16), true)
  assert.equal(onSpacingScale(6), true)
  assert.equal(onSpacingScale(5), false)
  assert.equal(onSpacingScale(13), false)
})
