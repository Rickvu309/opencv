import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import test from "node:test"
import {
  LEDGER,
  fingerprint,
  guardFiles,
  ledgerProblems,
  prove,
  readProofs,
  realIo,
  root,
} from "./guard-ledger.mjs"
import { listGuardFiles } from "./list-checks.mjs"
import { CI_ONLY_GUARDS, FAST_GUARDS } from "./ocv-tools/jobs/push-checks.mjs"

const tracked = () =>
  execFileSync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard"],
    { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }
  )
    .split("\n")
    .filter(Boolean)

const read = (file) => readFileSync(path.join(root, file), "utf8")

const PAST = { mode: "detect", sha: "abc1234", path: "src/a.tsx" }
const DETECTOR = { module: "scripts/lib/x.mjs", export: "x" }
const row = (extra = {}) => ({
  id: "x",
  file: "scripts/x.test.mjs",
  historic: null,
  reason: "no past mistake",
  ...extra,
})
const problems = (over) =>
  ledgerProblems({
    ledger: [row()],
    files: ["scripts/x.test.mjs"],
    exists: () => true,
    proofs: {},
    ...over,
  })

test("every guard, and every test that imports detect, has a ledger row that names a real file with a passing proof", () => {
  const files = tracked()
  const found = guardFiles(
    files,
    (all) => listGuardFiles(() => all.join("\n")),
    read
  )
  assert.deepEqual(
    ledgerProblems({
      files: found,
      exists: (file) => existsSync(path.join(root, file)),
      proofs: readProofs(),
    }),
    []
  )
})

test("a guard with no row, a row for a missing file, and a row with no proof each fail", () => {
  assert.deepEqual(problems(), [])
  assert.match(
    problems({ files: ["scripts/x.test.mjs", "scripts/y.test.mjs"] })[0],
    /scripts\/y\.test\.mjs: guard has no row/
  )
  assert.match(
    problems({ exists: () => false })[0],
    /x: scripts\/x\.test\.mjs is missing/
  )
  assert.match(
    problems({ ledger: [row({ historic: PAST, detector: DETECTOR })] })[0],
    /x: no passing proof.*prove x/
  )
})

test("a proof counts only while the historic mistake it proved is unchanged", () => {
  const proven = row({ historic: PAST, detector: DETECTOR })
  const proofs = { x: { passed: true, fingerprint: fingerprint(proven) } }
  assert.deepEqual(problems({ ledger: [proven], proofs }), [])
  const moved = row({
    historic: { ...PAST, sha: "def5678" },
    detector: DETECTOR,
  })
  assert.equal(problems({ ledger: [moved], proofs }).length, 1)
  assert.equal(
    problems({
      ledger: [proven],
      proofs: { x: { passed: false, fingerprint: fingerprint(proven) } },
    }).length,
    1
  )
})

test("a null historic needs a reason, and two rows cannot share an id", () => {
  assert.match(
    problems({ ledger: [row({ reason: " " })] })[0],
    /gives no reason/
  )
  assert.match(problems({ ledger: [row(), row()] })[0], /id used by two rows/)
})

test("a test file that imports detect is a guard even outside a guard folder", () => {
  const files = ["lib/a.test.ts", "lib/b.test.ts", "lib/c.ts"]
  const sources = {
    "lib/a.test.ts": 'import { detect } from "./a"',
    "lib/b.test.ts": 'import { other } from "./b"',
    "lib/c.ts": 'import { detect } from "./c"',
  }
  assert.deepEqual(
    guardFiles(
      files,
      () => [],
      (file) => sources[file]
    ),
    ["lib/a.test.ts"]
  )
})

const detectIo = (shown) => ({
  detector: async () => (text) => text.includes("MISTAKE"),
  show: (rev) => shown[rev] ?? null,
})

test("detect proof passes when the past fires and HEAD stays quiet, and fails on either miss", async () => {
  const proven = row({ historic: PAST, detector: DETECTOR })
  const pass = await prove(
    proven,
    detectIo({ abc1234: "MISTAKE", HEAD: "clean" })
  )
  assert.equal(pass.ok, true)
  const gone = await prove(proven, detectIo({ abc1234: "MISTAKE" }))
  assert.equal(gone.ok, true)
  const silent = await prove(
    proven,
    detectIo({ abc1234: "clean", HEAD: "clean" })
  )
  assert.equal(silent.ok, false)
  const still = await prove(
    proven,
    detectIo({ abc1234: "MISTAKE", HEAD: "MISTAKE" })
  )
  assert.equal(still.ok, false)
})

const revertIo = (outcomes) => {
  const calls = []
  return {
    calls,
    changedFiles: () => ["src/a.ts", "src/a.test.ts", "src/test/b.ts"],
    inScratch: (run) =>
      run({
        revert: (fix, files) => calls.push(["revert", fix, files]),
        reset: () => calls.push(["reset"]),
        run: () => {
          calls.push(["run"])
          return outcomes.shift()
        },
      }),
  }
}
const REVERT = row({
  historic: { mode: "revert", fix: "fff0001", command: ["node", "check.mjs"] },
})

test("revert proof reverts only non-test files, expects a failure, resets and expects a pass", () => {
  const io = revertIo([false, true])
  const result = prove(REVERT, io)
  assert.equal(result.ok, true)
  assert.deepEqual(io.calls, [
    ["revert", "fff0001", ["src/a.ts"]],
    ["run"],
    ["reset"],
    ["run"],
  ])
  assert.equal(prove(REVERT, revertIo([true, true])).ok, false)
  assert.equal(prove(REVERT, revertIo([false, false])).ok, false)
})

test("a row whose historic is null has nothing to prove", () => {
  assert.equal(prove(row(), {}).ok, false)
})

test("this guard is classified for push or CI, never both", () => {
  const me = "scripts/guard-ledger.test.mjs"
  assert.equal(
    [...FAST_GUARDS, ...CI_ONLY_GUARDS].filter((file) => file === me).length,
    1
  )
  assert.ok(LEDGER.some((entry) => entry.file === me))
})

test("every detect proof still holds on the real history", async () => {
  for (const entry of LEDGER.filter((item) => item.historic?.mode === "detect"))
    assert.equal((await prove(entry, realIo)).ok, true, entry.id)
})
