import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"
import path from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"
import { detectUnboundedSpawn } from "./lib/unbounded-spawn.mjs"
import { expiredMessage, expiredPending } from "./lib/pending-fixes.mjs"

const root = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..")
const GIT_TIMEOUT_MS = 30_000
const TLC_BEFORE_TIMEOUT = "42da036c"

const PENDING = [
  "scripts/check.test.mjs",
  "scripts/ci-workflow.test.mjs",
  "scripts/pen-snapshot.test.mjs",
  "scripts/temp-dirs.test.mjs",
  "scripts/ocv-tools/result.test.mjs",
  "scripts/ocv-tools/ports/proc.mjs",
  "scripts/pr/release.test.mjs",
].map((file) => ({ file, issue: "#933", expires: "2026-12-03" }))

const MISTAKES = [
  'spawnSync("java", ["-jar", jar], { cwd })',
  "spawnSync(java, args, { encoding: 'utf8' })",
  "child.execFileSync(process.execPath, [script])",
  'execSync("pnpm test")',
]
const CLEAN = [
  'spawnSync("java", args, { timeout: 60_000 })',
  "spawnSync(java, args, { ...options, timeout })",
  'execFileSync("git", ["status"])',
  'execFileSync("gh", ["pr", "view"], { encoding: "utf8" })',
  'const text = "spawnSync(java, args)"',
]

const scripts = () =>
  execFileSync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard", "scripts"],
    { cwd: root, encoding: "utf8", timeout: GIT_TIMEOUT_MS }
  )
    .split("\n")
    .filter((file) => /\.(?:mjs|js|ts)$/.test(file))

test("a long tool call with no timeout in scripts is refused", () => {
  for (const text of MISTAKES)
    assert.equal(detectUnboundedSpawn(text).length, 1, text)
  for (const text of CLEAN)
    assert.deepEqual(detectUnboundedSpawn(text), [], text)
})

test("the java call the tlc runner once made with no timeout is caught", (t) => {
  let old
  try {
    old = execFileSync(
      "git",
      ["show", `${TLC_BEFORE_TIMEOUT}:scripts/tlc.mjs`],
      {
        cwd: root,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
        timeout: GIT_TIMEOUT_MS,
      }
    )
  } catch {
    return t.skip(`commit ${TLC_BEFORE_TIMEOUT} is not in this clone`)
  }
  assert.deepEqual(
    detectUnboundedSpawn(old, "scripts/tlc.mjs").map((hit) => hit.command),
    ["java"]
  )
})

test("every pending entry is unexpired and still needs its entry", () => {
  assert.equal(expiredMessage(expiredPending(PENDING)), "")
  const stale = PENDING.filter(
    (entry) =>
      detectUnboundedSpawn(
        readFileSync(path.join(root, entry.file), "utf8"),
        entry.file
      ).length === 0
  )
  assert.deepEqual(
    stale.map((entry) => entry.file),
    [],
    "These files now bound every long call. Delete their pending entries."
  )
})

test("no script starts a long-running tool without a timeout", () => {
  const pending = new Set(PENDING.map((entry) => entry.file))
  const offenders = scripts()
    .filter((file) => !pending.has(file))
    .flatMap((file) =>
      detectUnboundedSpawn(
        readFileSync(path.join(root, file), "utf8"),
        file
      ).map((hit) => `${file}:${hit.line}`)
    )
  assert.deepEqual(
    offenders,
    [],
    `${offenders.join(", ")} starts a tool with no timeout. Pass { timeout: <ms> } so a hung child cannot hang the check.`
  )
})
