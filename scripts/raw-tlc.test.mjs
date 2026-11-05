import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"
import { detectRawTlc } from "./lib/raw-tlc.mjs"

const root = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..")
const GIT_TIMEOUT_MS = 30_000
const SIGN_IN_SKILL_AT_29D5D586 = [
  "cd apps/api/src",
  "~/.local/jdk/bin/java -cp ~/.local/tla/tla2tools.jar tlc2.TLC -workers 1 -config AuthOtp.cfg AuthOtp.tla",
  "~/.local/jdk/bin/java -cp ~/.local/tla/tla2tools.jar tlc2.TLC -workers 1 -config AuthOtp.mutant.cfg AuthOtp.tla",
  "```",
].join("\n")

const ALLOWED = new Set([
  "scripts/tlc.mjs",
  "scripts/tla-specs.test.mjs",
  "scripts/raw-tlc.test.mjs",
  ".github/workflows/ci.yml",
])

const MISTAKE =
  "~/.local/jdk/bin/java -cp ~/.local/tla/tla2tools.jar tlc2.TLC -workers 1 -config A.cfg A.tla\n"
const CLEAN = "node scripts/tlc.mjs apps/api/src/AuthOtp.tla --mutant\n"

const scanned = () =>
  execFileSync(
    "git",
    [
      "ls-files",
      "--cached",
      "--others",
      "--exclude-standard",
      "scripts",
      ".github",
      "package.json",
      "**/package.json",
    ],
    { cwd: root, encoding: "utf8", timeout: GIT_TIMEOUT_MS }
  )
    .split("\n")
    .filter((file) => file && !ALLOWED.has(file))
    .filter((file) => existsSync(path.join(root, file)))

test("a raw tlc2.TLC or tla2tools.jar call outside scripts/tlc.mjs is refused", () => {
  assert.equal(detectRawTlc(MISTAKE).length, 1)
  assert.deepEqual(detectRawTlc(CLEAN), [])
})

test("the raw java commands the sign-in skill once held are caught", () => {
  assert.deepEqual(
    detectRawTlc(SIGN_IN_SKILL_AT_29D5D586).map((hit) => hit.line),
    [2, 3]
  )
})

test("the checks workflow pins the jar and launches models only through scripts/tlc.mjs", () => {
  const workflow = readFileSync(
    path.join(root, ".github/workflows/ci.yml"),
    "utf8"
  )
  assert.match(workflow, /tla2tools\.jar/)
  assert.match(workflow, /node scripts\/tlc\.mjs --all/)
  assert.equal(
    detectRawTlc(workflow).some((hit) => /tlc2\.TLC/.test(hit.text)),
    false
  )
})

test("no skill, script or package.json calls the model checker except through scripts/tlc.mjs", () => {
  const offenders = scanned().flatMap((file) =>
    detectRawTlc(readFileSync(path.join(root, file), "utf8")).map(
      (hit) => `${file}:${hit.line}`
    )
  )
  assert.deepEqual(
    offenders,
    [],
    `${offenders.join(", ")} runs the model checker itself. Use node scripts/tlc.mjs <Spec.tla> [--mutant].`
  )
})
