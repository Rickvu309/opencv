// The PR review's classification of a verify checker run. Run: node --test scripts/lib/verify-gate.test.mjs
import assert from "node:assert/strict"
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"

import { allowedList, classify, combineRuns, invariantIds, main, parseChecks, parseKnown } from "./verify-gate.mjs"

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
  for (const exit of [2, 130, 143, 124]) {
    const { problems } = classify({ output: "verify-app-ui error: port 4450 is in use", exit, known: [] })
    assert.equal(problems[0].state, "ERROR")
    assert.match(problems[0].text, new RegExp(`${exit === 124 ? "timed out" : `exited ${exit}`}.*port 4450`))
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

test("an invariant id main expects but the run did not report fails, unless it is listed", () => {
  const output = [line("PASS", "01", "ok"), "summary"].join("\n")
  const { problems } = classify({ output, exit: 0, known: [], expected: ["01", "02"] })
  assert.deepEqual(problems.map((p) => [p.state, p.id]), [["MISSING", "02"]])
  assert.equal(classify({ output, exit: 0, known: known("02"), expected: ["01", "02"] }).problems[0].state.startsWith("LISTED"), true)
})

test("the allowed list is main's entries the PR keeps: a PR can only shrink it", () => {
  const main = known("20", "27")
  assert.deepEqual(allowedList(main, known("20")), { allowed: known("20"), added: [] })
  assert.deepEqual(allowedList(main, []), { allowed: [], added: [] })
  assert.deepEqual(allowedList(main, known("20", "27", "41")).added, ["41"])
  assert.deepEqual(allowedList(main, known("27", "41")).allowed.map((e) => e.id), ["27"])
})

test("invariant ids come from a kinds table, numbers and strings alike", () => {
  const text = 'export const KINDS = {\n  "01": "invariant",\n  "06": "design",\n  10: "invariant",\n  "20b": "invariant",\n}'
  assert.deepEqual(invariantIds(text), ["01", "10", "20b"])
})

const fail = (id, text) => ({ state: "NEW FAIL", id, name: "n", text })
const result = (problems) => ({ problems, counts: { pass: 1 } })

test("a NEW FAIL counts only when it is a NEW FAIL in both runs, and both runs' text is printed", () => {
  const both = combineRuns(result([fail("34", "2400 ms")]), result([fail("34", "2100 ms")]))
  assert.equal(both.problems.length, 1)
  assert.equal(both.problems[0].text, "2100 ms | run 1: 2400 ms")
  assert.deepEqual(both.flaky, [])
})

test("a NEW FAIL in one run only is flaky: reported, not a problem", () => {
  const first = combineRuns(result([fail("34", "2400 ms")]), result([]))
  assert.deepEqual(first.problems, [])
  assert.match(first.flaky[0].text, /run 1 only.*2400 ms/)
  const second = combineRuns(result([fail("34", "2400 ms")]), result([fail("35", "late")]))
  assert.deepEqual(second.problems, [])
  assert.deepEqual(second.flaky.map((p) => p.id), ["34", "35"])
})

test("any other problem in either run still counts once", () => {
  const stale = { state: "STALE", id: "04", name: "n", text: "x" }
  const merged = combineRuns(result([fail("34", "a"), stale]), result([stale, { state: "ERROR", id: "-", text: "exited 130" }]))
  assert.deepEqual(merged.problems.map((p) => p.state), ["STALE", "ERROR"])
})

const withFiles = (fn) => {
  const dir = mkdtempSync(join(tmpdir(), "verify-gate-"))
  const put = (name, text) => (writeFileSync(join(dir, name), text), join(dir, name))
  const out = []
  const orig = console.log
  console.log = (s) => out.push(s)
  try {
    fn(put, out, dir)
  } finally {
    console.log = orig
  }
  return out
}

test("check reads a log and a known list and sets the exit code", () => {
  const out = withFiles((put) => {
    const list = put("known.json", JSON.stringify(known("20")))
    const log = put("log", [line("FAIL", "20", "bad"), line("PASS", "01", "ok")].join("\n"))
    assert.equal(main(["check", "--log", log, "--exit", "1", "--known", list]), 0)
    const worse = put("log", line("FAIL", "21", "worse"))
    assert.equal(main(["check", "--log", worse, "--exit", "1", "--known", list]), 1)
    assert.equal(main(["check", "--log", worse, "--exit", "1", "--known", "-"]), 1)
    put("known.json", "{ not json")
    assert.equal(main(["check", "--log", worse, "--exit", "1", "--known", list]), 1)
    assert.equal(main(["check", "--log", worse]), 2)
  })
  assert.ok(out.some((l) => l.startsWith("NEW FAIL 21 some name: worse")))
  assert.ok(out.some((l) => l.startsWith("ERROR -:")))
})

test("check with a second run: flaky passes with a FLAKY line, consistent NEW FAIL fails, an error is not forgiven", () => {
  const out = withFiles((put) => {
    const list = put("known.json", "[]")
    const bad = put("bad", [line("FAIL", "34", "2400 ms"), line("PASS", "01", "ok")].join("\n"))
    const good = put("good", [line("PASS", "34", "ok"), line("PASS", "01", "ok")].join("\n"))
    const args = (a, b, exit2 = "0") => ["check", "--log", a, "--exit", "1", "--known", list, "--log2", b, "--exit2", exit2]
    assert.equal(main(args(bad, good)), 0)
    assert.equal(main(args(bad, bad, "1")), 1)
    assert.equal(main(args(bad, good, "130")), 1)
  })
  assert.ok(out.some((l) => l.startsWith("FLAKY 34 some name: NEW FAIL in run 1 only")))
  assert.ok(out.some((l) => l.startsWith("gate: pass") && l.includes("1 flaky")))
  assert.ok(out.some((l) => l.startsWith("NEW FAIL 34 some name: 2400 ms | run 1: 2400 ms")))
  assert.ok(out.some((l) => l.startsWith("ERROR -: checker exited 130")))
})

test("list writes the allowed entries and prints the added ids; expect writes the shared invariant ids", () => {
  const out = withFiles((put, _out, dir) => {
    const mainList = put("main.json", JSON.stringify(known("20", "27")))
    const prList = put("pr.json", JSON.stringify(known("27", "41")))
    const allowed = join(dir, "allowed.json")
    assert.equal(main(["list", mainList, prList, allowed]), 0)
    assert.deepEqual(parseKnown(readFileSync(allowed, "utf8")).map((e) => e.id), ["27"])
    assert.equal(main(["list", mainList, put("bad.json", "{"), allowed]), 1)
    assert.equal(main(["list", join(dir, "none.json"), join(dir, "none.json"), allowed]), 0)
    const mk = put("main.mjs", '{\n "01": "invariant",\n "02": "invariant",\n "03": "design",\n}')
    const pk = put("pr.mjs", '{\n "01": "invariant",\n "03": "invariant",\n}')
    const expected = join(dir, "expected.json")
    assert.equal(main(["expect", mk, pk, expected]), 0)
    assert.deepEqual(JSON.parse(readFileSync(expected, "utf8")), ["01"])
    assert.equal(main(["expect", join(dir, "none.mjs"), pk, expected]), 0)
    assert.deepEqual(JSON.parse(readFileSync(expected, "utf8")), [])
  })
  assert.deepEqual(out.filter((l) => l.startsWith("ADDED")), ["ADDED 41"])
  assert.ok(out.some((l) => l.startsWith("ERROR -:")))
})
