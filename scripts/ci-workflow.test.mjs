import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"
import { detect } from "./ci-first-errors.mjs"
import { tempDir } from "./lib/temp-dir.mjs"
import {
  detect as formalDetect,
  modelChanges,
  policyChoice,
} from "./lib/ci-workflow.mjs"

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
  const listed = needs[1]
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean)
  const others = jobNames.filter((name) => name !== "ci")
  assert.deepEqual([...listed].sort(), [...others].sort())
  assert.match(ci, /^ {4}if:\s*\$\{\{\s*always\(\)\s*\}\}/m)
})

test("the registry formal suite runs against a real Postgres server", () => {
  const job = section("formal-postgres")
  assert.match(job, /^ {8}image: postgres:18\s*$/m)
  assert.match(job, /^ {6}FORMAL_DATABASE_URL: postgres:\/\/\S+$/m)
  assert.match(job, /turbo run test:formal \$TURBO_SCOPE --filter=api/)
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

const TLA_SHA256 =
  "936a262061c914694dfd669a543be24573c45d5aa0ff20a8b96b23d01e050e88"
const MAPS = {
  "apps/api/src/registry/UndoLater.tla.json": JSON.stringify({
    module: "registry.ts",
    actions: { Write: "commit" },
  }),
  "apps/api/src/AuthOtp.tla.json": JSON.stringify({
    module: "better-auth/dist/plugins/email-otp/routes.mjs",
    version: "1.7.14",
    actions: { Read: "checkVerificationOTP" },
  }),
  "a/Broken.tla.json": "{",
}
const root = fileURLToPath(new URL("..", import.meta.url))

function runBody(job) {
  const lines = job.split("\n")
  const start = lines.findIndex((line) => line === "        run: |")
  assert.ok(start >= 0, "a run block")
  const body = []
  for (const line of lines.slice(start + 1)) {
    if (line.trim() === "") body.push("")
    else if (line.startsWith("          ")) body.push(line.slice(10))
    else break
  }
  return body.join("\n")
}

function bash(script, env) {
  return spawnSync("bash", ["-c", script], {
    cwd: root,
    env: { ...process.env, ...env },
    encoding: "utf8",
  })
}

test("the formal model job pins Temurin 21 and tla2tools 1.7.4", () => {
  const job = section("formal-tla")
  assert.match(job, /actions\/setup-java@v4/)
  assert.match(job, /distribution: temurin/)
  assert.match(job, /java-version: "21"/)
  assert.match(job, /actions\/cache@v4/)
  assert.match(job, new RegExp(TLA_SHA256))
  assert.match(job, /tla2tools-1\.7\.4-\$\{\{ env\.TLA_SHA256 \}\}/)
  assert.match(
    job,
    /https:\/\/github\.com\/tlaplus\/tlaplus\/releases\/download\/v1\.7\.4\/tla2tools\.jar/
  )
  assert.match(job, /sha256sum -c -/)
  assert.match(job, /JAVA_HOME: \$\{\{ steps\.java\.outputs\.path \}\}/)
  assert.match(job, /TLA2TOOLS: \$\{\{ github\.workspace \}\}.*tla2tools\.jar/)
  assert.match(job, /node scripts\/tlc\.mjs --all/)
  assert.doesNotMatch(job, /tlc2\.TLC/)
  assert.match(job, /node scripts\/lib\/ci-workflow\.mjs gate/)
  assert.match(job, /steps\.gate\.outputs\.run == 'true'/)
  assert.deepEqual(formalDetect(text, ".github/workflows/ci.yml"), [])
})

test("a workflow with no model job and no policy skip fires", () => {
  const old = [
    "jobs:",
    "  policy:",
    "    steps:",
    "      - run: |",
    '          echo "::error title=POLICY::no pull request number in the ${GITHUB_EVENT_NAME} event"',
    "          exit 1",
    "  ci:",
    "    needs: [policy]",
    "",
  ].join("\n")
  const hits = formalDetect(old, ".github/workflows/ci.yml")
  assert.ok(hits.some((hit) => hit.includes("formal-tla")))
  assert.ok(hits.some((hit) => hit.includes("policy skip notice")))
  assert.deepEqual(formalDetect(old, "README.md"), [])
})

test("a model file or a file named in a spec map runs the models", () => {
  assert.deepEqual(modelChanges(["apps/api/src/AuthOtp.tla"], MAPS), [
    "apps/api/src/AuthOtp.tla",
  ])
  assert.deepEqual(modelChanges(["apps/api/src/AuthOtp.mutant.cfg"], MAPS), [
    "apps/api/src/AuthOtp.mutant.cfg",
  ])
  assert.deepEqual(modelChanges(["apps/api/src/AuthOtp.tla.json"], MAPS), [
    "apps/api/src/AuthOtp.tla.json",
  ])
  assert.deepEqual(modelChanges(["apps/api/src/registry/registry.ts"], MAPS), [
    "apps/api/src/registry/registry.ts",
  ])
  assert.deepEqual(modelChanges(["scripts/tlc.mjs"], MAPS), ["scripts/tlc.mjs"])
  assert.deepEqual(modelChanges([".github/workflows/ci.yml"], MAPS), [
    ".github/workflows/ci.yml",
  ])
  assert.deepEqual(modelChanges(["apps/web/src/main.tsx"], MAPS), [])
  assert.deepEqual(
    modelChanges(
      ["apps/api/src/better-auth/dist/plugins/email-otp/routes.mjs"],
      MAPS
    ),
    []
  )
  assert.deepEqual(
    modelChanges(["apps/api/src/registry/registry.ts"], {
      "a/Broken.tla.json": "{",
    }),
    []
  )
})

test("the merge queue always runs the model check", (t) => {
  const out = join(tempDir(t, "formal-gate-"), "output")
  const run = bash(runBody(section("formal-tla")), {
    GITHUB_EVENT_NAME: "merge_group",
    GITHUB_OUTPUT: out,
  })
  assert.equal(run.status, 0, run.stderr)
  assert.equal(readFileSync(out, "utf8").trim(), "run=true")
})

test("policy skips an event with no pull request and fails a pull request event with no number", () => {
  assert.deepEqual(
    policyChoice({ event: "push", prNumber: "", queueRef: "" }),
    {
      kind: "skip",
      event: "push",
    }
  )
  assert.deepEqual(
    policyChoice({ event: "workflow_dispatch", prNumber: "", queueRef: "" }),
    { kind: "skip", event: "workflow_dispatch" }
  )
  assert.deepEqual(
    policyChoice({ event: "pull_request", prNumber: "", queueRef: "" }),
    { kind: "fail", event: "pull_request" }
  )
  assert.deepEqual(
    policyChoice({
      event: "pull_request_target",
      prNumber: "",
      queueRef: "",
    }),
    { kind: "fail", event: "pull_request_target" }
  )
  assert.deepEqual(
    policyChoice({
      event: "merge_group",
      prNumber: "",
      queueRef: "refs/heads/gh-readonly-queue/main/deadbeef",
    }),
    { kind: "fail", event: "merge_group" }
  )
  assert.deepEqual(
    policyChoice({
      event: "merge_group",
      prNumber: "",
      queueRef: "refs/heads/gh-readonly-queue/main/pr-15-abcdef",
    }),
    { kind: "run", number: "15" }
  )
  assert.deepEqual(
    policyChoice({ event: "pull_request", prNumber: "1030", queueRef: "" }),
    { kind: "run", number: "1030" }
  )
  const script = runBody(section("policy"))
  assert.match(script, /node scripts\/ocv-tools\.mjs policy/)
  const skip = bash(script, {
    GITHUB_EVENT_NAME: "push",
    PR_NUMBER: "",
    QUEUE_REF: "",
  })
  assert.equal(skip.status, 0, skip.stderr)
  assert.match(
    skip.stdout,
    /::notice title=POLICY::no pull request applies to the push event/
  )
  const missing = bash(script, {
    GITHUB_EVENT_NAME: "pull_request",
    PR_NUMBER: "",
    QUEUE_REF: "",
  })
  assert.equal(missing.status, 1)
  assert.match(
    missing.stdout,
    /::error title=POLICY::no pull request number in the pull_request event/
  )
  const queue = bash(script, {
    GITHUB_EVENT_NAME: "merge_group",
    PR_NUMBER: "",
    QUEUE_REF: "refs/heads/gh-readonly-queue/main/deadbeef",
  })
  assert.equal(queue.status, 1)
  assert.match(
    queue.stdout,
    /::error title=POLICY::no pull request number in the merge_group event/
  )
})
