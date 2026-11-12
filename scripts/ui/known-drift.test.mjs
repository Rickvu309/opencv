import assert from "node:assert/strict"
import test from "node:test"

import { summaryLine } from "./check-all.mjs"
import {
  baseCheckFor,
  checkBaseScreen,
  knownFailureLines,
  markKnownFailures,
  staleBaseLine,
} from "./known-drift.mjs"
import { checkSummary, renderPrSection } from "./pr-section.mjs"

const failure = (element, property, rendered) => ({
  element,
  property,
  design: 52,
  rendered,
  difference: rendered - 52,
  status: "mismatch",
})

const here = {
  screen: "paper-home",
  compared: 3,
  failed: 2,
  failures: [
    failure("Paper page header", "height", 32),
    failure("Paper body", "gap", 20),
  ],
}

test("a failure that also fails on main is known and every other failure is new", () => {
  const marked = markKnownFailures(here, {
    screen: "paper-home",
    failures: [failure("Paper page header", "height", 32)],
  })
  assert.equal(marked.newFailed, 1)
  assert.equal(marked.knownFailed, 1)
  assert.deepEqual(marked.failures[0].onMain, { rendered: 32, changed: false })
  assert.equal(marked.failures[1].onMain, null)
  assert.deepEqual(knownFailureLines(marked), [
    "new since main: Paper body gap",
    "changed since main: none",
    "already failing on main: Paper page header height",
  ])
  assert.equal(
    summaryLine(marked),
    "paper-home: FAIL, 3 compared, 2 failed, 1 already failing on main"
  )
})

test("a known failure whose value changed on the branch counts as new and shows both values", () => {
  const worse = {
    screen: "paper-home",
    compared: 1,
    failed: 1,
    failures: [failure("Paper page header", "height", 70)],
  }
  const marked = markKnownFailures(worse, {
    screen: "paper-home",
    failures: [failure("Paper page header", "height", 30)],
  })
  assert.equal(marked.newFailed, 1)
  assert.equal(marked.knownFailed, 0)
  assert.deepEqual(knownFailureLines(marked), [
    "new since main: none",
    "changed since main: Paper page header height 30 on main, 70 here",
    "already failing on main: none",
  ])
  assert.equal(
    summaryLine(marked),
    "paper-home: FAIL, 1 compared, 1 failed, 0 already failing on main"
  )
})

test("a manifest is called out when its base is not this branch's merge-base with origin/main", () => {
  const main = "a".repeat(40)
  const older = "b".repeat(40)
  assert.equal(staleBaseLine({ baseSha: main }, main), null)
  assert.equal(
    staleBaseLine({ baseSha: older }, main),
    "known drift: the manifest was made on bbbbbbbbbbbb, but this branch's merge-base with origin/main is aaaaaaaaaaaa; its main results may be stale, rerun node scripts/ui.mjs compare"
  )
  assert.match(staleBaseLine({ captures: [] }, main), /records no base commit/)
  assert.match(staleBaseLine({ baseSha: main }, null), /could not find/)
})

test("with no base result, or a base that errored, nothing is marked", () => {
  for (const base of [undefined, null, { screen: "paper-home", error: "x" }]) {
    const marked = markKnownFailures(here, base)
    assert.equal(marked, here)
    assert.deepEqual(knownFailureLines(marked), [])
    assert.equal(summaryLine(marked), "paper-home: FAIL, 3 compared, 2 failed")
  }
})

test("a base that passes makes every failure new", () => {
  const marked = markKnownFailures(here, { screen: "paper-home", failures: [] })
  assert.equal(marked.newFailed, 2)
  assert.deepEqual(knownFailureLines(marked), [
    "new since main: Paper page header height; Paper body gap",
    "changed since main: none",
    "already failing on main: none",
  ])
})

test("compare keeps a base check that throws as an error result", async () => {
  const thrown = await checkBaseScreen(
    async () => {
      throw new Error("step 3 failed\nstack")
    },
    null,
    null,
    { id: "paper-home" }
  )
  assert.deepEqual(thrown, { screen: "paper-home", error: "step 3 failed" })
  assert.equal(
    await checkBaseScreen(async () => null, null, null, { id: "coach-home" }),
    null
  )
  assert.equal(baseCheckFor({ baseChecks: { a: here } }, "a"), here)
  assert.equal(baseCheckFor({ captures: [] }, "a"), undefined)
})

test("the PR section adds a new-since-main column when check read the base", () => {
  const summary = checkSummary("paper-home", {
    lines: [
      JSON.stringify({
        screen: "paper-home",
        compared: 3,
        failed: 2,
        newFailed: 1,
        knownFailed: 1,
      }),
    ],
  })
  assert.deepEqual(summary, {
    screen: "paper-home",
    compared: 3,
    failed: 2,
    newFailed: 1,
  })
  const section = renderPrSection({
    manifest: { base: "origin/main", baseSha: "29c4ce33aaaa", captures: [] },
    uploaded: [],
    checks: [summary, { screen: "settings", error: "unreachable" }],
  })
  assert.match(section, /\| screen \| compared \| failed \| new since main \|/)
  assert.match(section, /\| paper-home \| 3 \| 2 \| 1 \|/)
  assert.match(section, /\| settings \| unreachable \| \| \|/)
})
