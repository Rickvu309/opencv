import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"

import {
  judge,
  outputTail,
  parsePenLayout,
  runProblems,
  VERDICT_TAIL_LINES,
} from "./lib/ci-screens.mjs"

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

test("a fake driver that exits without a verdict prints the last lines it wrote", () => {
  const child = spawnSync(
    process.execPath,
    [
      "-e",
      `for (let i = 0; i < 40; i++) console.log("stdout " + i)
console.error("stderr cause: the page reloaded")
process.exit(2)`,
    ],
    { encoding: "utf8", timeout: 10_000 }
  )
  assert.equal(child.status, 2)
  const output = `${child.stdout ?? ""}${child.stderr ?? ""}`
  const tail = outputTail(output)
  assert.equal(tail.length, VERDICT_TAIL_LINES)
  assert.equal(tail.includes("stdout 0"), false)
  assert.equal(tail.at(-1), "stderr cause: the page reloaded")
  const verdict = judge({
    results: [
      {
        id: "pen-layout",
        status: "error",
        detail: "exit 2",
        output,
      },
    ],
    skips: [],
    today,
  })
  assert.equal(verdict.failed, true)
  const text = verdict.lines.join("\n")
  assert.match(
    text,
    /^FAIL pen-layout exit 2: the driver did not produce a verdict/
  )
  assert.match(text, /stderr cause: the page reloaded/)
  assert.equal(text.includes("stdout 0"), false)
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
  assert.match(text, /^ {4}needs:\s*\[[^\]]*\bscreens\b[^\]]*\]/m)
  assert.match(text, /node scripts\/ci-screens\.mjs/)
  const minutes = /^ {2}screens:[\s\S]*?timeout-minutes: (\d+)/m.exec(text)
  assert.ok(Number(minutes[1]) <= 15)
})

const scriptsDir = fileURLToPath(
  new URL("../.claude/skills/verify-app-ui/scripts/", import.meta.url)
)

test("the run table names real drivers, unique ids and a full own-stack setup", () => {
  const runs = JSON.parse(
    readFileSync(new URL("./ci-screens.runs.json", import.meta.url), "utf8")
  )
  assert.deepEqual(
    runProblems(runs, (script) => existsSync(join(scriptsDir, script))),
    []
  )
  assert.ok(runs.some((run) => run.verdict === "frames"))
})

test("a run table with a duplicate id, a missing driver or a half own-stack run fires", () => {
  const problems = runProblems(
    [
      { id: "a", script: "real.mjs", stack: "shared" },
      { id: "a", script: "real.mjs", stack: "shared" },
      { id: "b", script: "gone.mjs", stack: "shared" },
      { id: "c", script: "real.mjs", stack: "own", port: 1 },
      { id: "d", script: "real.mjs", stack: "elsewhere" },
    ],
    (script) => script === "real.mjs"
  )
  assert.equal(problems.length, 7)
  assert.match(problems.join("\n"), /a is listed twice/)
  assert.match(problems.join("\n"), /b names no driver script/)
  assert.match(problems.join("\n"), /c runs its own stack but has no shotsEnv/)
  assert.match(problems.join("\n"), /d has stack elsewhere/)
})

test("ci-screens runs only the drivers its run table lists", () => {
  const text = readFileSync(
    new URL("./ci-screens.mjs", import.meta.url),
    "utf8"
  )
  assert.match(text, /RUNS_FILE/)
  assert.deepEqual(text.match(/verify-[\w-]+\.mjs/g), null)
})
