// The PR review's classification of a verify checker run. Run: node --test scripts/lib/verify-gate.test.mjs
import assert from "node:assert/strict"
import { mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"

import { classify, main, parseChecks, parseKnown } from "./verify-gate.mjs"

const line = (status, id, measured) => `${status} ${id} [invariant] some name: ${measured} | rule: some rule`
const run = (lines, known = []) =>
  classify({ output: [...lines, "summary"].join("\n"), exit: lines.some((l) => l.startsWith("STALE")) ? 3 : lines.some((l) => l.startsWith("FAIL")) ? 1 : 0, known })
const known = (...ids) => ids.map((id) => ({ id, issue: 1, since: "2026-10-29", note: "n" }))

test("pass: no problem", () => {
  const { problems, counts } = run([line("PASS", "01", "ok"), line("PASS", "02", "ok")])
  assert.deepEqual(problems, [])
  assert.equal(counts.pass, 2)
})

test("a listed FAIL is known and allowed", () => {
  const { problems, counts } = run([line("FAIL", "20", "bad"), line("PASS", "01", "ok")], known("20"))
  assert.deepEqual(problems, [])
  assert.equal(counts.known, 1)
})

test("an unlisted FAIL is new and fails, naming the id and the measured text", () => {
  const { problems } = run([line("FAIL", "01", "x".repeat(300)), line("FAIL", "20", "bad")], known("20"))
  assert.equal(problems.length, 1)
  assert.equal(problems[0].state, "NEW FAIL")
  assert.equal(problems[0].id, "01")
  assert.equal(problems[0].name, "some name")
  assert.equal(problems[0].text, "x".repeat(160))
})

test("a PASS that is still listed is fixed and fails until the entry is removed", () => {
  const { problems } = run([line("PASS", "20", "now fine")], known("20"))
  assert.equal(problems.length, 1)
  assert.match(problems[0].state, /^FIXED/)
  assert.equal(problems[0].id, "20")
})

test("a STALE fails, listed or not", () => {
  assert.equal(run([line("STALE", "04", "not judged: x")]).problems[0].state, "STALE")
  assert.equal(run([line("STALE", "04", "not judged: x")], known("04")).problems[0].state, "STALE")
})

test("a listed id the checker no longer reports fails, so the list cannot rot", () => {
  const { problems } = run([line("PASS", "01", "ok")], known("99"))
  assert.equal(problems.length, 1)
  assert.match(problems[0].state, /^LISTED/)
})

test("a checker exit 2, any unexpected exit, or no check lines is an error", () => {
  for (const exit of [2, 130, 143]) {
    const { problems } = classify({ output: "verify-app-ui error: port 4450 is in use", exit, known: [] })
    assert.equal(problems[0].state, "ERROR")
    assert.match(problems[0].text, new RegExp(`exited ${exit}.*port 4450`))
  }
  const empty = classify({ output: "verify-landing http://x\n0 PASS, 0 FAIL, 0 STALE", exit: 0, known: [] })
  assert.equal(empty.problems[0].state, "ERROR")
})

test("a name with a colon still yields the measured text", () => {
  const [c] = parseChecks("FAIL 20 [invariant] a: b: measured here | rule: r")
  assert.equal(c.id, "20")
  assert.equal(c.status, "FAIL")
  assert.match(c.measured, /measured here$/)
})

test("known-findings.json is validated", () => {
  assert.deepEqual(parseKnown(""), [])
  assert.throws(() => parseKnown("{}"), /array/)
  assert.throws(() => parseKnown('[{"id":"20"}]'), /needs string id/)
  assert.throws(() => parseKnown(JSON.stringify([...known("20"), ...known("20")])), /twice/)
})

test("the command line reads a log and a known list and sets the exit code", () => {
  const dir = mkdtempSync(join(tmpdir(), "verify-gate-"))
  const log = join(dir, "log")
  const list = join(dir, "known.json")
  writeFileSync(list, JSON.stringify(known("20")))
  writeFileSync(log, [line("FAIL", "20", "bad"), line("PASS", "01", "ok")].join("\n"))
  const out = []
  const orig = console.log
  console.log = (s) => out.push(s)
  try {
    assert.equal(main([log, "1", list]), 0)
    writeFileSync(log, line("FAIL", "21", "worse"))
    assert.equal(main([log, "1", list]), 1)
    assert.equal(main([log, "1", "-"]), 1)
    writeFileSync(list, "{ not json")
    assert.equal(main([log, "1", list]), 1)
  } finally {
    console.log = orig
  }
  assert.ok(out.some((l) => l.startsWith("NEW FAIL 21 some name: worse")))
  assert.ok(out.some((l) => l.startsWith("ERROR -:")))
})
