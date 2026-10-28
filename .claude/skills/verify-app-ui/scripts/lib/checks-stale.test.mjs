// A check whose precondition failed must say STALE, never PASS or FAIL. Run: node --test .claude/skills/verify-app-ui/scripts/lib
import assert from "node:assert/strict"
import test from "node:test"

import { motionChecks } from "./checks-source.mjs"
import { coachErrorCheck } from "./checks-content.mjs"
import {
  result,
  scanProblem,
  sourceFiles,
  stale,
  summarize,
} from "./check-util.mjs"

const scan = (...dirs) => sourceFiles(dirs)

test("sourceFiles names a missing folder and still reads the others", () => {
  const found = scan(
    "apps/web/src/features/command-palette",
    "apps/web/src/features/gone"
  )
  assert.deepEqual(found.missing, ["apps/web/src/features/gone"])
  assert.ok(found.files.length > 0)
  assert.match(scanProblem(found), /missing: apps\/web\/src\/features\/gone/)
  assert.equal(scanProblem(scan("apps/web/src/features/command-palette")), null)
  assert.match(scanProblem({ files: [], missing: [] }), /zero files/)
})

test("source checks go STALE on a missing folder, not PASS", () => {
  const snap = { durations: {}, durationSamples: [], redOutsideAlert: [] }
  const screens = Object.fromEntries(
    ["home", "paper", "cv", "apply", "pitch"].map((k) => [k, snap])
  )
  const d = { reduced: {}, coachError: { alerts: [], stubHits: 1 } }
  const out = motionChecks(d, { allSnaps: [snap], screens }, [
    "apps/web/src/features/gone",
  ])
  const status = Object.fromEntries(out.map((r) => [r.id, r.status]))
  assert.equal(status["24"], "STALE")
  assert.equal(status["26"], "STALE")
  assert.match(out.find((r) => r.id === "24").measured, /features\/gone/)
  assert.equal(status["25"], "PASS")
})

const alertSnap = (text, stubHits) => ({ alerts: [text], stubHits })

test("04 is STALE when an intercept answered nothing", () => {
  const sentence = "Coach could not answer. Try again."
  for (const hits of [
    [0, 2],
    [2, 0],
    [undefined, 2],
  ]) {
    const found = coachErrorCheck({
      coachError: alertSnap(sentence, hits[0]),
      coachNet: alertSnap(sentence, hits[1]),
    })
    assert.equal(found.status, "STALE", String(hits))
    assert.match(found.measured, /never fired/)
  }
})

test("04 still judges the app once both stubs fired", () => {
  const sentence = "Coach could not answer. Try again."
  const pass = coachErrorCheck({
    coachError: alertSnap(sentence, 1),
    coachNet: alertSnap(sentence, 1),
  })
  assert.equal(pass.status, "PASS")
  const raw = coachErrorCheck({
    coachError: alertSnap("User not found.", 1),
    coachNet: alertSnap(sentence, 1),
  })
  assert.equal(raw.status, "FAIL")
})

test("summary and exit code: STALE is 3, FAIL is 1, all PASS is 0", () => {
  const pass = result("01", "a", true, "ok", "rule")
  const fail = result("02", "b", false, "bad", "rule")
  const gone = stale("03", "c", "folder missing", "rule")
  const mixed = summarize([pass, fail, gone])
  assert.equal(mixed.exit, 3)
  assert.equal(mixed.lines.at(-1), "1 PASS, 1 FAIL, 1 STALE: 02 03")
  assert.equal(mixed.lines[2], "STALE 03 c: folder missing | rule: rule")
  assert.equal(summarize([pass, fail]).exit, 1)
  assert.equal(
    summarize([pass, fail]).lines.at(-1),
    "1 PASS, 1 FAIL, 0 STALE: 02"
  )
  const clean = summarize([pass])
  assert.equal(clean.exit, 0)
  assert.equal(clean.lines.at(-1), "1 PASS, 0 FAIL, 0 STALE")
})
