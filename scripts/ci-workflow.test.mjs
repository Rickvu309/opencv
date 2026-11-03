import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { readFileSync } from "node:fs"
import test from "node:test"
import { fileURLToPath } from "node:url"
import { detect } from "./ci-first-errors.mjs"

const text = readFileSync(
  fileURLToPath(new URL("../.github/workflows/ci.yml", import.meta.url)),
  "utf8"
)
const jobsAt = text.search(/^jobs:\s*$/m)
const jobsBlock = text.slice(jobsAt)
const jobNames = [...jobsBlock.matchAll(/^ {2}([a-z][a-z0-9-]*):\s*$/gm)].map(
  (m) => m[1]
)
const section = (name) => {
  const start = jobsBlock.search(new RegExp(`^ {2}${name}:\\s*$`, "m"))
  const rest = jobsBlock.slice(start + 1)
  const next = rest.search(/^ {2}[a-z][a-z0-9-]*:\s*$/m)
  return next === -1 ? rest : rest.slice(0, next)
}

test("ci.yml runs for the merge queue", () => {
  assert.match(text.slice(0, jobsAt), /^ {2}merge_group:/m)
  assert.match(text.slice(0, jobsAt), /^ {2}pull_request:/m)
})

test("ci waits on every other job and always runs", () => {
  const ci = section("ci")
  const needs = /^ {4}needs:\s*\[([^\]]*)\]/m.exec(ci)
  assert.ok(needs, "ci has a needs list")
  const listed = needs[1].split(",").map((name) => name.trim())
  const others = jobNames.filter((name) => name !== "ci")
  assert.deepEqual([...listed].sort(), [...others].sort())
  assert.match(ci, /^ {4}if:\s*\$\{\{\s*always\(\)\s*\}\}/m)
})

const script = /node -e '([^\n]*)'\s*$/m.exec(section("ci"))?.[1]
function runAggregateStepFromCiYml(results) {
  const needs = Object.fromEntries(
    Object.entries(results).map(([name, result]) => [name, { result }])
  )
  return spawnSync(process.execPath, ["-e", script], {
    env: { ...process.env, NEEDS: JSON.stringify(needs) },
    encoding: "utf8",
  })
}

test("the ci aggregate passes only when every job succeeded", () => {
  assert.ok(script, "the aggregate step is a one-line node -e")
  assert.equal(
    runAggregateStepFromCiYml({ lint: "success", build: "success" }).status,
    0
  )
  for (const bad of ["failure", "cancelled", "skipped"]) {
    const run = runAggregateStepFromCiYml({ lint: "success", build: bad })
    assert.equal(run.status, 1, bad)
    assert.match(run.stderr, new RegExp(`build: ${bad}`))
  }
})

const MISTAKE =
  "jobs:\n  ci:\n    steps:\n      - run: node -e 'process.exit(1)'\n"
const CLEAN =
  "jobs:\n  ci:\n    steps:\n      - if: \"${{ contains(needs.*.result, 'failure') }}\"\n        run: node scripts/ci-first-errors.mjs\n"

test("a ci job that does not print the first error fires", () => {
  assert.equal(detect(MISTAKE, ".github/workflows/ci.yml").length, 1)
  assert.deepEqual(detect(MISTAKE, "README.md"), [])
})

test("a ci job that prints the first error stays quiet", () => {
  assert.deepEqual(detect(CLEAN, ".github/workflows/ci.yml"), [])
})

test("the ci job prints the first error of each failed job and still fails", () => {
  const ci = section("ci")
  assert.match(ci, /node scripts\/ci-first-errors\.mjs/)
  assert.match(ci, /contains\(needs\.\*\.result, 'failure'\)/)
  assert.match(ci, /GITHUB_TOKEN:/)
  assert.match(ci, /^ {6}actions: read\s*$/m)
  assert.match(ci, /^ {6}checks: read\s*$/m)
  assert.equal(detect(text, ".github/workflows/ci.yml").length, 0)
  assert.equal(runAggregateStepFromCiYml({ guards: "failure" }).status, 1)
})
