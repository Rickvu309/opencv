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
  const marked = markKnownFailures(
    here,
    {
      screen: "paper-home",
      failures: [failure("Paper page header", "height", 32)],
    },
    1
  )
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
    "paper-home: FAIL, 3 compared, 2 failed, 1 already failing on main, 0 changed since main"
  )
})

test("a known failure whose value changed on the branch counts as new and shows both values", () => {
  const worse = {
    screen: "paper-home",
    compared: 1,
    failed: 1,
    failures: [failure("Paper page header", "height", 70)],
  }
  const marked = markKnownFailures(
    worse,
    {
      screen: "paper-home",
      failures: [failure("Paper page header", "height", 30)],
    },
    1
  )
  assert.equal(marked.newFailed, 1)
  assert.equal(marked.knownFailed, 0)
  assert.deepEqual(knownFailureLines(marked), [
    "new since main: none",
    "changed since main: Paper page header height 30 on main, 70 here",
    "already failing on main: none",
  ])
  assert.equal(
    summaryLine(marked),
    "paper-home: FAIL, 1 compared, 1 failed, 0 already failing on main, 1 changed since main"
  )
})

test("sub-pixel noise inside the check tolerance keeps a main failure known, and a step past it is changed", () => {
  const at = (rendered) => ({
    screen: "paper-home",
    compared: 1,
    failed: 1,
    failures: [failure("Paper page header", "height", rendered)],
  })
  const main = {
    screen: "paper-home",
    failures: [failure("Paper page header", "height", 32)],
  }
  const noisy = markKnownFailures(at(32.4), main, 1)
  assert.equal(noisy.newFailed, 0)
  assert.equal(noisy.knownFailed, 1)
  assert.equal(noisy.failures[0].onMain.changed, false)
  const edge = markKnownFailures(at(33), main, 1)
  assert.equal(edge.failures[0].onMain.changed, false)
  const moved = markKnownFailures(at(33.5), main, 1)
  assert.equal(moved.newFailed, 1)
  assert.equal(moved.failures[0].onMain.changed, true)
  const strict = markKnownFailures(at(32.4), main, 0)
  assert.equal(strict.failures[0].onMain.changed, true)
  const lost = markKnownFailures(
    {
      ...at(32),
      failures: [
        { ...failure("Paper page header", "height", 32), rendered: null },
      ],
    },
    main,
    1
  )
  assert.equal(lost.failures[0].onMain.changed, true)
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
    const marked = markKnownFailures(here, base, 1)
    assert.equal(marked, here)
    assert.deepEqual(knownFailureLines(marked), [])
    assert.equal(summaryLine(marked), "paper-home: FAIL, 3 compared, 2 failed")
  }
})

test("a base that passes makes every failure new", () => {
  const marked = markKnownFailures(
    here,
    { screen: "paper-home", failures: [] },
    1
  )
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
