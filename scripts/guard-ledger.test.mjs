import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import path from "node:path"
import test from "node:test"
import {
  BASELINE_FILE,
  LEDGER,
  failureKind,
  fingerprint,
  guardFiles,
  hashOfFile,
  ledgerProblems,
  prove,
  readBaseline,
  readProofs,
  realIo,
  root,
  runCommand,
} from "./guard-ledger.mjs"
import { withTempDir } from "./lib/temp-dir.mjs"
import { listGuardFiles } from "./list-checks.mjs"
import { CI_ONLY_GUARDS, FAST_GUARDS } from "./ocv-tools/jobs/push-checks.mjs"

const tracked = () =>
  execFileSync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard"],
    { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }
  )
    .split("\n")
    .filter((file) => file && existsSync(path.join(root, file)))

const read = (file) => readFileSync(path.join(root, file), "utf8")

const BASELINE_CEILING = 49

const PAST = { mode: "detect", sha: "abc1234", path: "src/a.tsx" }
const REVERT_PAST = {
  mode: "revert",
  fix: "fff0001",
  command: ["node", "check.mjs"],
}
const RESTORE_PAST = {
  mode: "restore",
  sha: "abc1234",
  paths: ["src/a.ts", "src/a.test.ts"],
  command: ["node", "check.mjs"],
}
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
    hashOf: () => "h1",
    ...over,
  })

test("every guard, and every test that imports detect, has a ledger row or a baseline entry, and a row with a proof keeps it", () => {
  const files = tracked()
  const found = guardFiles(
    files,
    (all) => listGuardFiles(() => all.join("\n")),
    read
  )
  assert.deepEqual(
    ledgerProblems({
      files: found,
      baseline: readBaseline(),
      exists: (file) => existsSync(path.join(root, file)),
      proofs: readProofs(),
      hashOf: hashOfFile,
    }),
    []
  )
})

test("the baseline of guards without a row only shrinks and stays sorted", () => {
  const baseline = readBaseline()
  assert.equal(
    baseline.length,
    BASELINE_CEILING,
    `${BASELINE_FILE} has ${baseline.length} entries but BASELINE_CEILING is ${BASELINE_CEILING}. Removing a baseline entry means lowering BASELINE_CEILING in scripts/guard-ledger.test.mjs in the same commit, so a deleted guard's slot cannot be reused.`
  )
  assert.deepEqual(baseline, [...baseline].sort())
})

test("a guard in neither the ledger nor the baseline fails, and a baseline entry that has a row or is gone is stale", () => {
  assert.match(
    problems({ files: ["scripts/x.test.mjs", "scripts/y.test.mjs"] })[0],
    /y\.test\.mjs: guard has no row/
  )
  assert.deepEqual(
    problems({
      files: ["scripts/x.test.mjs", "scripts/y.test.mjs"],
      baseline: ["scripts/y.test.mjs"],
    }),
    []
  )
  assert.match(
    problems({ baseline: ["scripts/x.test.mjs"] })[0],
    /x\.test\.mjs: has a row/
  )
  assert.match(
    problems({
      baseline: ["scripts/z.test.mjs"],
      exists: (file) => file !== "scripts/z.test.mjs",
    })[0],
    /z\.test\.mjs: is gone/
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
  assert.deepEqual(
    problems({ ledger: [row({ historic: PAST, detector: DETECTOR })] }),
    []
  )
  assert.match(
    problems({ ledger: [row({ historic: REVERT_PAST })] })[0],
    /x: no passing proof.*prove x/
  )
})

test("a detect row whose path is gone at HEAD is refused unless it names a fixed file", () => {
  const exists = (file) => file !== PAST.path
  assert.match(
    problems({
      ledger: [row({ historic: PAST, detector: DETECTOR })],
      exists,
    })[0],
    /gone at HEAD.*historic\.fixed/
  )
  const fixed = { ...PAST, fixed: { rev: "HEAD", path: "src/b.tsx" } }
  assert.deepEqual(
    problems({
      ledger: [row({ historic: fixed, detector: DETECTOR })],
      exists,
    }),
    []
  )
})

test("a proof counts only while the historic mistake and the guard file it proved are unchanged", () => {
  const proven = row({ historic: REVERT_PAST })
  const proofs = {
    x: { passed: true, fingerprint: fingerprint(proven, () => "h1") },
  }
  assert.deepEqual(problems({ ledger: [proven], proofs }), [])
  const moved = row({ historic: { ...REVERT_PAST, fix: "def5678" } })
  assert.equal(problems({ ledger: [moved], proofs }).length, 1)
  assert.equal(
    problems({ ledger: [proven], proofs, hashOf: () => "h2" }).length,
    1
  )
  assert.equal(
    problems({
      ledger: [proven],
      proofs: { x: { passed: false, fingerprint: proofs.x.fingerprint } },
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

test("a detect proof reads named companion files at the historic sha", async () => {
  const proven = row({
    historic: { ...PAST, reads: ["src/styles/paper.css"] },
    detector: DETECTOR,
  })
  const seen = []
  const result = await prove(proven, {
    detector: async () => (text, _file, world) => {
      if (!world?.read) return false
      const css = world.read("src/styles/paper.css")
      seen.push(css)
      return text.includes("QVE-208") && css.includes("only-in-note")
    },
    show: (rev, file) =>
      ({
        "abc1234:src/a.tsx": 'indexOf("QVE-208")',
        "abc1234:src/styles/paper.css": "/* only-in-note */",
        "HEAD:src/a.tsx": "clean",
      })[`${rev}:${file}`] ?? null,
  })
  assert.equal(result.ok, true)
  assert.deepEqual(seen, ["/* only-in-note */"])
})

test("detect proof passes when the past fires and HEAD stays quiet, and fails on either miss", async () => {
  const proven = row({ historic: PAST, detector: DETECTOR })
  const pass = await prove(
    proven,
    detectIo({ abc1234: "MISTAKE", HEAD: "clean" })
  )
  assert.equal(pass.ok, true)
  const gone = await prove(proven, detectIo({ abc1234: "MISTAKE" }))
  assert.equal(gone.ok, false)
  assert.match(gone.lines[1], /vacuous/)
  const fixedRow = row({
    historic: { ...PAST, fixed: { rev: "HEAD", path: "src/b.tsx" } },
    detector: DETECTOR,
  })
  const elsewhere = {
    detector: async () => (text) => text.includes("MISTAKE"),
    show: (rev, file) =>
      ({ "abc1234:src/a.tsx": "MISTAKE", "HEAD:src/b.tsx": "clean" })[
        `${rev}:${file}`
      ] ?? null,
  }
  assert.equal((await prove(fixedRow, elsewhere)).ok, true)
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

const ASSERT_OUTPUT = "AssertionError [ERR_ASSERTION]: made a temporary folder"
const CRASH_OUTPUT =
  "Error [ERR_MODULE_NOT_FOUND]: Cannot find module './h.mjs'"

const revertIo = (outcomes, applies = true) => {
  const calls = []
  return {
    calls,
    changedFiles: () => ["src/a.ts", "src/a.test.ts", "src/test/b.ts"],
    inScratch: (run) =>
      run({
        revert: (fix, files) => {
          calls.push(["revert", fix, files])
          if (!applies) throw new Error("patch does not apply\nsecond line")
        },
        restore: (sha, files) => {
          calls.push(["restore", sha, files])
          if (!applies) throw new Error("pathspec did not match\nsecond line")
        },
        reset: () => calls.push(["reset"]),
        run: () => {
          calls.push(["run"])
          return outcomes.shift()
        },
      }),
  }
}
const passed = { passed: true, output: "ok" }
const asserted = { passed: false, output: ASSERT_OUTPUT }
const crashed = { passed: false, output: CRASH_OUTPUT }
const REVERT = row({ historic: REVERT_PAST })

test("revert proof reverts only non-test files, expects an assertion failure, resets and expects a pass", () => {
  const io = revertIo([asserted, passed])
  const result = prove(REVERT, io)
  assert.equal(result.ok, true)
  assert.deepEqual(io.calls, [
    ["revert", "fff0001", ["src/a.ts"]],
    ["run"],
    ["reset"],
    ["run"],
  ])
  assert.ok(result.lines.some((line) => line.includes(ASSERT_OUTPUT)))
  assert.equal(prove(REVERT, revertIo([passed, passed])).ok, false)
  assert.equal(prove(REVERT, revertIo([asserted, asserted])).ok, false)
})

test("a revert that crashes on an import is the wrong reason, not detection", () => {
  const result = prove(REVERT, revertIo([crashed, passed]))
  assert.equal(result.ok, false)
  assert.match(result.lines[0], /WRONG REASON \(crash/)
  assert.ok(result.lines.some((line) => line.includes("ERR_MODULE_NOT_FOUND")))
})

test("a reverse patch that does not apply fails with a line, not a stack trace", () => {
  const result = prove(REVERT, revertIo([], false))
  assert.equal(result.ok, false)
  assert.match(result.lines[0], /does not apply: patch does not apply$/)
})

test("restore proof brings back only the non-test files from the past, expects an assertion failure, resets and expects a pass", () => {
  const RESTORE = row({ historic: RESTORE_PAST })
  const io = revertIo([asserted, passed])
  const result = prove(RESTORE, io)
  assert.equal(result.ok, true)
  assert.deepEqual(io.calls, [
    ["restore", "abc1234", ["src/a.ts"]],
    ["run"],
    ["reset"],
    ["run"],
  ])
  assert.equal(prove(RESTORE, revertIo([passed, passed])).ok, false)
  assert.equal(prove(RESTORE, revertIo([crashed, passed])).ok, false)
  const missing = prove(RESTORE, revertIo([], false))
  assert.equal(missing.ok, false)
  assert.match(
    missing.lines[0],
    /cannot restore src\/a\.ts: pathspec did not match$/
  )
})

test("failureKind tells a crash and an unknown failure from an assertion", () => {
  assert.equal(failureKind(ASSERT_OUTPUT), "assertion")
  assert.equal(failureKind(CRASH_OUTPUT), "crash")
  assert.equal(failureKind("SyntaxError: Unexpected token"), "crash")
  assert.equal(failureKind("Killed"), "unknown")
})

test("a mutant that deletes an imported module is reported as the wrong reason on a real run", () => {
  withTempDir("guard-ledger-fixture-", (dir) => {
    writeFileSync(path.join(dir, "helper.mjs"), "export const value = 1\n")
    writeFileSync(
      path.join(dir, "a.test.mjs"),
      'import assert from "node:assert/strict"\nimport test from "node:test"\nimport { value } from "./helper.mjs"\ntest("value", () => assert.equal(value, 1))\n'
    )
    const command = ["node", "--test", "a.test.mjs"]
    assert.equal(runCommand(dir, command).passed, true)
    rmSync(path.join(dir, "helper.mjs"))
    const crash = runCommand(dir, command)
    assert.equal(crash.passed, false)
    assert.equal(failureKind(crash.output), "crash")
    writeFileSync(path.join(dir, "helper.mjs"), "export const value = 2\n")
    const wrong = runCommand(dir, command)
    assert.equal(wrong.passed, false)
    assert.equal(failureKind(wrong.output), "assertion")
  })
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

test("each proof is its own file named after a ledger row, and the shared proofs file stays gone", () => {
  assert.equal(
    existsSync(path.join(root, "scripts/guard-ledger.proofs.json")),
    false
  )
  const ids = new Set(LEDGER.map((row) => row.id))
  const orphans = Object.keys(readProofs()).filter((id) => !ids.has(id))
  assert.deepEqual(orphans, [])
})

test("readProofs reads one record per file in the folder", () => {
  withTempDir("guard-proofs", (dir) => {
    writeFileSync(
      path.join(dir, "a.json"),
      JSON.stringify({ passed: true, fingerprint: "f" })
    )
    writeFileSync(path.join(dir, "notes.txt"), "x")
    assert.deepEqual(readProofs(dir), {
      a: { passed: true, fingerprint: "f" },
    })
  })
  assert.deepEqual(readProofs(path.join(root, "scripts/no-such-folder")), {})
})
