import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { fixture } from "./fixture.mjs"
import { WHY_LINE_LIMIT, reproOf, whyLines } from "./why.mjs"

const here = (path) => readFileSync(new URL(path, import.meta.url), "utf8")
const RUN_1451 = JSON.parse(here("./why-fixtures/pr-1451-round-1-run.json"))
const LOG_1451 = here("./why-fixtures/pr-1451-round-1-test-web-2.txt")
const NODE_LOG = here(
  "../../ci-first-errors.fixtures/node-test-41576406863-125720815496.txt"
)

function world({ run, jobs, logs = {}, annotations = [] }) {
  return fixture({
    runs: run ? [run] : [],
    runJobs: jobs,
    annotations,
    intercept(cmd, args) {
      if (cmd !== "gh" || args[1] !== "--allow-escape-sequences") return null
      const id = /jobs\/(\d+)\/logs$/.exec(args[2])?.[1]
      return id in logs
        ? { ok: true, out: logs[id], err: "" }
        : { ok: false, out: "", err: "HTTP 404" }
    },
  })
}

const why = (f) => f.call("why", "91")

test("why replays PR 1451 round 1 and names request-boundary.test.ts with its repro", () => {
  const f = world({
    run: RUN_1451.run,
    jobs: RUN_1451.jobs,
    logs: { 131575101122: LOG_1451 },
  })
  const r = why(f)
  assert.equal(r.code, 0, r.text)
  assert.match(r.text, /ci run 43330918402 on head-1 failure: 1 failed job\./)
  assert.match(
    r.text,
    /test-web \(2\) failed: apps\/web\/src\/test\/request-boundary\.test\.ts/
  )
  assert.match(
    r.text,
    /AssertionError: expected \[ 'routes\/paper-doc\.tsx: queryKey: \[' \]/
  )
  assert.match(
    r.text,
    /repro: pnpm --dir apps\/web exec vitest run src\/test\/request-boundary\.test\.ts/
  )
  assert.doesNotMatch(r.text, /^ci failed/m)
})

test("why on a green run says green and nothing else", () => {
  const f = world({
    run: {
      id: 5,
      status: "completed",
      conclusion: "success",
      event: "pull_request",
    },
    jobs: [
      {
        id: 1,
        name: "guards",
        status: "completed",
        conclusion: "success",
        steps: [{}],
      },
    ],
  })
  const r = why(f)
  assert.equal(r.code, 0, r.text)
  assert.match(r.text, /ci run 5 on head-1 is green\./)
  assert.doesNotMatch(r.text, /repro/)
})

test("why on a run still in progress prints the failures so far and says it is not finished", () => {
  const f = world({
    run: {
      id: 6,
      status: "in_progress",
      conclusion: null,
      event: "pull_request",
    },
    jobs: [
      {
        id: 61,
        name: "guards",
        status: "completed",
        conclusion: "failure",
        steps: [{}],
      },
      {
        id: 62,
        name: "test-web (1)",
        status: "in_progress",
        conclusion: null,
        steps: [{}],
      },
      {
        id: 63,
        name: "static",
        status: "completed",
        conclusion: "success",
        steps: [{}],
      },
    ],
    logs: { 61: NODE_LOG },
  })
  const r = why(f)
  assert.match(
    r.text,
    /ci run 6 on head-1 is not finished: 2 of 3 jobs done\. Failures so far:/
  )
  assert.match(r.text, /guards failed: scripts\/local-port-range\.test\.mjs/)
  assert.match(
    r.text,
    /repro: node --test scripts\/local-port-range\.test\.mjs/
  )
  const quiet = world({
    run: { id: 7, status: "queued", conclusion: null, event: "pull_request" },
    jobs: [],
  })
  assert.match(
    why(quiet).text,
    /is not finished: 0 of 0 jobs done\. No failure so far\./
  )
})

test("why reads the failure note of a job that never ran a step, and of a log it cannot read", () => {
  const f = world({
    run: {
      id: 8,
      status: "completed",
      conclusion: "failure",
      event: "pull_request",
    },
    jobs: [
      {
        id: 81,
        name: "policy",
        status: "completed",
        conclusion: "failure",
        steps: [],
      },
      {
        id: 82,
        name: "ci",
        status: "completed",
        conclusion: "failure",
        steps: [{}],
      },
    ],
    annotations: [
      {
        annotation_level: "failure",
        message: "OWNER_YES: this pull request is owner class",
      },
    ],
  })
  const r = why(f)
  assert.match(
    r.text,
    /policy failed\n  OWNER_YES: this pull request is owner class/
  )
  assert.match(r.text, /repro: gh run view 8 --job 81 --log-failed \| tail -80/)
  assert.doesNotMatch(r.text, /^ci failed/m)
})

test("why with no ci run on the head says so", () => {
  const r = why(world({ jobs: [] }))
  assert.equal(r.code, 0, r.text)
  assert.match(r.text, /PR #91: no ci run on head-1 yet/)
})

test("why output stays within 30 lines however many jobs fail", () => {
  const jobs = Array.from({ length: 12 }, (_, i) => ({
    id: i,
    name: `job-${i}`,
    status: "completed",
    conclusion: "failure",
  }))
  const lines = whyLines({
    pr: 9,
    head: "h".repeat(40),
    ciRun: { id: 9, status: "completed", conclusion: "failure" },
    jobs,
    casesOf: () =>
      [1, 2, 3].map((k) => ({
        file: `scripts/t${k}.test.mjs`,
        line: "x".repeat(400),
        repro: "r",
      })),
  })
  assert.equal(lines.length, WHY_LINE_LIMIT)
  assert.match(lines.at(-1), /more lines: gh run view 9 --log-failed/)
  assert.ok(lines.every((line) => line.length <= 240))
})

test("repro lines: node tests, package tests and the log fallback", () => {
  const job = { id: 4, name: "x" }
  assert.equal(
    reproOf("scripts/a.test.mjs", null, 1, job),
    "node --test scripts/a.test.mjs"
  )
  assert.equal(
    reproOf("apps/api/src/b.test.ts", "apps/api", 1, job),
    "pnpm --dir apps/api exec vitest run src/b.test.ts"
  )
  assert.equal(
    reproOf(null, null, 1, job),
    "gh run view 1 --job 4 --log-failed | tail -80"
  )
})
