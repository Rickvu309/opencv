import assert from "node:assert/strict"
import { test } from "node:test"

import {
  brandViolations,
  capturedGlowViews,
  chromeCopy,
  contrastNeeded,
  contrastRatio,
  dashViolations,
  emptyActionLabels,
  exclamationViolations,
  extraGlowPrimaries,
  hasBasisSentence,
  metricClaims,
  nounViolations,
  offTokenDurations,
  onSpacingScale,
  otherProductNames,
  showsRawMessage,
  titleBeforeCompany,
  toggleViolations,
} from "./text-rules.mjs"

test("nouns: Opportunity and Thread are flagged, and Job is allowed", () => {
  const found = nounViolations([
    "Add job",
    "Jobs",
    "Edit profile",
    "New document",
    "Draft a Letter",
    "Add opportunity",
    "Start a new Thread",
    "A first full-time job",
    "Attach Sample CV to an Opportunity",
    "New Thread",
  ])
  assert.deepEqual(
    found.map((f) => f.label),
    ["Edit profile", "New document", "Add opportunity", "Start a new Thread"]
  )
})

test("nouns: the Paper empty sentence is exempt and a near copy is not", () => {
  const found = nounViolations([
    "No documents yet. Create a CV, Letter, or Proof to start.",
    "No documents yet. Create a document to start.",
    "Start a document",
    "Pick a page, or bring a file you already have.",
    "Document name",
    "New document",
  ])
  assert.deepEqual(
    found.map((f) => f.label),
    [
      "No documents yet. Create a document to start.",
      "Document name",
      "New document",
    ]
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
    ["Connect email to send this job"]
  )
})

test("empty action labels", () => {
  assert.deepEqual(
    emptyActionLabels(["Learn more", "More", "Add opportunity"]),
    ["Learn more"]
  )
})

test("nouns: Inbox connect copy and the scan count are exempt", () => {
  const found = nounViolations([
    "Never miss a recruiter reply",
    "Reads job emails only. Nothing is sent without you.",
    "No job emails yet",
    "No job emails yet Scan",
    "Finding your job emails",
    "6 emails from 6 companies so far",
    "Forward this email",
  ])
  assert.deepEqual(
    found.map((item) => item.label),
    ["Forward this email"]
  )
})

test("other product names", () => {
  assert.deepEqual(otherProductNames("like Instagram Stories"), ["Instagram"])
  assert.deepEqual(otherProductNames("like Twitter"), ["Twitter"])
  assert.deepEqual(otherProductNames("Tap a highlight to play it."), [])
  assert.deepEqual(otherProductNames("Connect Gmail"), [])
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

test("39 brand is the mark plus lowercase opencv", () => {
  assert.deepEqual(
    brandViolations(["Log in to opencv", "Welcome to OpenCV"]).map(
      (item) => item.label
    ),
    ["Welcome to OpenCV"]
  )
})

test("40 one glow primary per view", () => {
  assert.deepEqual(extraGlowPrimaries([0, 1, 2, 3]), [2, 3])
  assert.deepEqual(extraGlowPrimaries([0, 1]), [])
})

test("40 inbox reader glow of 1 passes and 2 fails", () => {
  const views = capturedGlowViews({
    inbox: { glowCount: 1 },
    reduced: { inbox: { glowCount: 1 } },
    inboxReader: { glowCount: 2 },
  })
  assert.deepEqual(extraGlowPrimaries(views.map((view) => view.count)), [2])
})

test("40 counts every captured view, including the empty board", () => {
  const views = capturedGlowViews({
    coach: { glowCount: 0 },
    apply: { glowCount: 1 },
    applyEmpty: { glowCount: 2 },
    mobile: { apply: { glowCount: 0 } },
    timing: { coach: 12 },
    logs: [],
  })
  assert.deepEqual(
    views.map((view) => view.name),
    ["coach", "apply", "applyEmpty", "mobile-apply"]
  )
  assert.deepEqual(extraGlowPrimaries(views.map((view) => view.count)), [2])
})

test("39 and 41 read the document title and the chrome meta line", () => {
  const copy = chromeCopy(
    ["Add job"],
    ["OpenCV", "CV · Sample · replace anytime"]
  )
  assert.deepEqual(
    brandViolations(copy).map((item) => item.label),
    ["OpenCV"]
  )
  assert.deepEqual(dashViolations(copy), ["CV · Sample · replace anytime"])
})

test("41 no em dash or middle dot", () => {
  assert.deepEqual(
    dashViolations(["Jun 2025 to now", "Jun 2025 — now", "A · B"]),
    ["Jun 2025 — now", "A · B"]
  )
})

test("42 toggles read Enabled or Disabled", () => {
  assert.deepEqual(
    toggleViolations(["Enabled", "On", "Connected", "Disabled"]),
    ["On", "Connected"]
  )
})

test("43 job title before company", () => {
  assert.deepEqual(titleBeforeCompany(["Designer at Acme", "at Acme"]), [
    "at Acme",
  ])
})

test("44 no exclamation mark or Oops", () => {
  assert.deepEqual(exclamationViolations(["Job saved", "Oops", "Saved!"]), [
    "Oops",
    "Saved!",
  ])
})
