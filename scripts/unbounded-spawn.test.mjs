import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"
import { detectUnboundedSpawn } from "./lib/unbounded-spawn.mjs"

const root = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..")
const GIT_TIMEOUT_MS = 30_000
const TLC_BEFORE_TIMEOUT = "42da036c"

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
    .filter((file) => existsSync(path.join(root, file)))

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

test("no script starts a long-running tool without a timeout", () => {
  const offenders = scripts().flatMap((file) =>
    detectUnboundedSpawn(readFileSync(path.join(root, file), "utf8"), file).map(
      (hit) => `${file}:${hit.line}`
    )
  )
  assert.deepEqual(
    offenders,
    [],
    `${offenders.join(", ")} starts a tool with no timeout. Pass { timeout: <ms> } so a hung child cannot hang the check.`
  )
})
