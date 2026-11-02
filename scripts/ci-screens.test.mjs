import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { fileURLToPath } from "node:url"

import { judge, parsePenLayout } from "./lib/ci-screens.mjs"

const skip = (id, expires = "2026-11-16") => ({
  id,
  reason: "Proofs header",
  issue: "#894",
  expires,
})
const today = "2026-11-02"

test("a failing screen with no skip fails the job", () => {
  const verdict = judge({
    results: [{ id: "pen-layout:AAA", status: "fail" }],
    skips: [],
    today,
  })
  assert.equal(verdict.failed, true)
})

test("a failing screen with a live skip is reported loudly and passes", () => {
  const verdict = judge({
    results: [{ id: "pen-layout:AAA", status: "fail" }],
    skips: [skip("pen-layout:AAA")],
    today,
  })
  assert.equal(verdict.failed, false)
  assert.match(verdict.lines[0], /^SKIPPED pen-layout:AAA.*#894.*2026-11-16/)
})

test("a skip fails the job once its screen passes again", () => {
  const verdict = judge({
    results: [{ id: "pen-layout:AAA", status: "pass" }],
    skips: [skip("pen-layout:AAA")],
    today,
  })
  assert.equal(verdict.failed, true)
  assert.match(verdict.lines[0], /STALE SKIP/)
})

test("a skip past its expiry fails the job even while the screen fails", () => {
  const verdict = judge({
    results: [{ id: "pen-layout:AAA", status: "fail" }],
    skips: [skip("pen-layout:AAA", "2026-11-01")],
    today,
  })
  assert.equal(verdict.failed, true)
  assert.match(verdict.lines[0], /SKIP EXPIRED/)
})

test("a skip for a screen no driver reported fails the job", () => {
  const verdict = judge({
    results: [{ id: "pen-layout:BBB", status: "pass" }],
    skips: [skip("pen-layout:AAA")],
    today,
  })
  assert.equal(verdict.failed, true)
})

test("a driver without a verdict fails the job and is never skippable by silence", () => {
  const verdict = judge({
    results: [{ id: "apply-pen", status: "error" }],
    skips: [],
    today,
  })
  assert.equal(verdict.failed, true)
})

test("pen layout output becomes one result per frame", () => {
  const output = [
    "SKIP YRYO8 /paper: set up and measured by something",
    'FAIL FCDYX /proofs "Paper" y: pen 16.5 app 0.5',
    "FAIL FCDYX /proofs: 16 texts, 3 mismatches",
    "PASS RAl5t /pitch: 22 texts, 0 mismatches",
  ].join("\n")
  assert.deepEqual(
    parsePenLayout(output).map((r) => [r.id, r.status]),
    [
      ["pen-layout:FCDYX", "fail"],
      ["pen-layout:RAl5t", "pass"],
    ]
  )
})

test("every skip entry names an issue and an expiry", () => {
  const skips = JSON.parse(
    readFileSync(
      fileURLToPath(new URL("./ci-screens.skips.json", import.meta.url)),
      "utf8"
    )
  )
  for (const entry of skips) {
    assert.match(entry.issue, /^#\d+$/, entry.id)
    assert.match(entry.expires, /^\d{4}-\d{2}-\d{2}$/, entry.id)
    assert.ok(entry.reason.length > 3, entry.id)
  }
})

test("ci.yml runs the screens job and the aggregate waits on it", () => {
  const text = readFileSync(
    fileURLToPath(new URL("../.github/workflows/ci.yml", import.meta.url)),
    "utf8"
  )
  assert.match(text, /^ {2}screens:\s*$/m)
  assert.match(text, /^ {4}needs: \[[^\]]*\bscreens\b[^\]]*\]/m)
  assert.match(text, /node scripts\/ci-screens\.mjs/)
  const minutes = /^ {2}screens:[\s\S]*?timeout-minutes: (\d+)/m.exec(text)
  assert.ok(Number(minutes[1]) <= 15)
})
