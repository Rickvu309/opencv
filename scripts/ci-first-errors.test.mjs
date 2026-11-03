import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import {
  collect,
  commandEnv,
  firstError,
  reportLine,
} from "./ci-first-errors.mjs"

const logs = JSON.parse(
  readFileSync(
    new URL("./ci-first-errors.snapshot.json", import.meta.url),
    "utf8"
  )
)

test("the first vitest failure is the line agents grep for", () => {
  const hit = firstError(logs.vitest)
  assert.equal(
    hit.line,
    "FAIL  scripts/ci-workflow.test.mjs > the aggregate passes"
  )
  assert.equal(hit.file, "scripts/ci-workflow.test.mjs")
  assert.equal(
    reportLine("guards", logs.vitest),
    "guards: FAIL  scripts/ci-workflow.test.mjs > the aggregate passes"
  )
})

test("a node test failure names the file from the following location line", () => {
  assert.equal(
    reportLine("test-api", logs.nodeTest),
    "test-api: scripts/ci-workflow.test.mjs: not ok 2 - waits"
  )
})

test("a build error with no test file is the error line alone", () => {
  assert.equal(
    reportLine("build", logs.build),
    "build: Error: Cannot find module '@workspace/domain'"
  )
})

test("a screen failure keeps the test file that sits above the error", () => {
  assert.equal(
    reportLine("screens", logs.screen),
    "screens: apps/web/e2e/sign-in.spec.ts: Error: expect(locator).toBeVisible()"
  )
})

test("a marked failure line is kept when it already names the test file", () => {
  assert.equal(
    reportLine("test-web", logs.mark),
    "test-web: ✖ apps/web/src/features/inbox/inbox-page.test.tsx (5 ms)"
  )
})

test("FAILURE is not a failure line, and a clean log has none", () => {
  assert.equal(firstError(logs.word).line, "Error: real boom")
  assert.equal(reportLine("lint", logs.clean), "lint: no error line")
})

test("a workflow annotation is the error, and the process-completed line is not", () => {
  assert.equal(
    reportLine("policy", logs.annotation),
    "policy: an expected failure (it.fails) must cite an issue that stays open after this merge: apps/api/src/registry/registry.formal.test.ts:257 names no issue"
  )
})

test("gh is called with GITHUB_TOKEN and one line is printed per failed job", () => {
  assert.equal(commandEnv({ GITHUB_TOKEN: "token" }).GH_TOKEN, "token")
  const calls = []
  const lines = collect(
    {
      GITHUB_RUN_ID: "40837431936",
      GITHUB_REPOSITORY: "Rickvu309/opencv",
      GITHUB_TOKEN: "token",
    },
    (args) => {
      calls.push(args)
      const target = args.find((arg) => String(arg).startsWith("repos/"))
      if (String(target).includes("/runs/")) return "guards\t10\nbuild\t11\n"
      if (String(target).endsWith("/10/logs")) {
        assert.ok(args.includes("--allow-escape-sequences"))
        return logs.vitest
      }
      if (String(target).endsWith("/11/logs")) return logs.build
      throw new Error(args.join(" "))
    }
  )
  assert.deepEqual(calls[0].slice(0, 2), [
    "api",
    "repos/Rickvu309/opencv/actions/runs/40837431936/jobs",
  ])
  assert.deepEqual(lines, [
    "guards: FAIL  scripts/ci-workflow.test.mjs > the aggregate passes",
    "build: Error: Cannot find module '@workspace/domain'",
  ])
})

test("a missing run id is refused and a log that cannot be read still yields one line", () => {
  assert.throws(
    () => collect({ GITHUB_REPOSITORY: "o/r", GITHUB_TOKEN: "t" }),
    /GITHUB_RUN_ID/
  )
  const lines = collect(
    {
      GITHUB_RUN_ID: "1",
      GITHUB_REPOSITORY: "o/r",
      GITHUB_TOKEN: "t",
    },
    (args) => {
      const target = args.find((arg) => String(arg).startsWith("repos/"))
      if (String(target).includes("/runs/")) return "guards\t10\n"
      throw new Error("logs unavailable")
    }
  )
  assert.deepEqual(lines, ["guards: could not read the log"])
})
