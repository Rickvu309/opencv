import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import {
  collect,
  commandEnv,
  firstError,
  reportLine,
} from "./ci-first-errors.mjs"

const fixture = (name) =>
  readFileSync(
    new URL(`./ci-first-errors.fixtures/${name}`, import.meta.url),
    "utf8"
  )

const vitest = fixture("vitest-41570112411-125700767167.txt")
const nodeTest = fixture("node-test-41576406863-125720815496.txt")
const policy = fixture("policy-41578367264-125727105647.txt")
const billing = fixture("billing-41545890442-125621292107.txt").trim()

const VITEST_LINE =
  "FAIL  src/health.test.ts > GET /health/deep > reports mail:false and 503 when sign-in mail is not configured (incident I4) — AssertionError: expected { ok: false, sha: 'abc1234', …(3) } to deeply equal { ok: false, sha: 'abc1234', …(3) }"
const NODE_LINE =
  "scripts/local-port-range.test.mjs: ✖ every pending entry is unexpired and pins its exact hit count (3.476151ms) — AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:"
const POLICY_LINE =
  "an expected failure (it.fails) must cite an issue that stays open after this merge: apps/api/src/registry/registry.formal.test.ts:257 names no issue; apps/api/src/registry/registry.formal.test.ts:351 cites #758, which is closed fix: Fix the bug and turn the it.fails back into it, or cite the open issue that still tracks it and drop that issue from Closes"

test("a recorded vitest log reports the FAIL line and the assertion after it", () => {
  assert.equal(
    reportLine("test-api (1)", vitest),
    `test-api (1): ${VITEST_LINE}`
  )
  assert.equal(firstError(vitest).line.includes("exited (1)"), false)
  assert.equal(
    firstError(vitest).line.includes("synthetic-provider-failure"),
    false
  )
})

test("a recorded node test log reports the failing test and its assertion", () => {
  assert.equal(reportLine("guards", nodeTest), `guards: ${NODE_LINE}`)
  assert.equal(firstError(nodeTest).line.startsWith("✖ failing tests:"), false)
  assert.equal(firstError(nodeTest).line.includes("exited (1)"), false)
})

test("a recorded policy refusal is the annotation, not the process-completed line", () => {
  assert.equal(reportLine("policy", policy), `policy: ${POLICY_LINE}`)
})

test("a bare Error line is used only when no test line or annotation matched", () => {
  assert.equal(
    reportLine(
      "screens",
      "  1) [chromium] › apps/web/e2e/sign-in.spec.ts:12:5 › sign in\n    Error: expect(locator).toBeVisible()\n"
    ),
    "screens: apps/web/e2e/sign-in.spec.ts: Error: expect(locator).toBeVisible()"
  )
  assert.equal(
    firstError("The job conclusion was FAILURE\nError: real boom\n").line,
    "Error: real boom"
  )
  assert.equal(reportLine("lint", "All tests passed\n"), "lint: no error line")
  assert.equal(
    reportLine(
      "guards",
      "not ok 2 - waits\n  AssertionError: expected 1 to equal 2\n"
    ),
    "guards: not ok 2 - waits — AssertionError: expected 1 to equal 2"
  )
})

test("gh is called with GITHUB_TOKEN and one line is printed per failed job", () => {
  assert.equal(commandEnv({ GITHUB_TOKEN: "token" }).GH_TOKEN, "token")
  const calls = []
  const lines = collect(
    {
      GITHUB_RUN_ID: "41570112411",
      GITHUB_REPOSITORY: "Rickvu309/opencv",
      GITHUB_TOKEN: "token",
    },
    (args) => {
      calls.push(args)
      const target = args.find((arg) => String(arg).startsWith("repos/"))
      if (String(target).includes("/runs/"))
        return "test-api (1)\t125700767167\t8\npolicy\t125727105647\t6\n"
      if (String(target).endsWith("/125700767167/logs")) {
        assert.ok(args.includes("--allow-escape-sequences"))
        return vitest
      }
      if (String(target).endsWith("/125727105647/logs")) return policy
      throw new Error(args.join(" "))
    }
  )
  assert.deepEqual(calls[0].slice(0, 2), [
    "api",
    "repos/Rickvu309/opencv/actions/runs/41570112411/jobs",
  ])
  assert.match(calls[0].at(-1), /\.steps/)
  assert.deepEqual(lines, [
    `test-api (1): ${VITEST_LINE}`,
    `policy: ${POLICY_LINE}`,
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
      if (String(target).includes("/runs/")) return "guards\t10\t4\n"
      throw new Error("logs unavailable")
    }
  )
  assert.deepEqual(lines, ["guards: could not read the log"])
})

test("a job that never started prints its billing annotation", () => {
  const calls = []
  const lines = collect(
    {
      GITHUB_RUN_ID: "41545890442",
      GITHUB_REPOSITORY: "Rickvu309/opencv",
      GITHUB_TOKEN: "token",
    },
    (args) => {
      calls.push(args)
      const target = args.find((arg) => String(arg).startsWith("repos/"))
      if (String(target).includes("/runs/")) return "lint\t125621292107\t0\n"
      if (String(target).includes("/check-runs/125621292107/annotations"))
        return `${billing}\n`
      throw new Error(args.join(" "))
    }
  )
  assert.deepEqual(lines, [`lint: ${billing}`])
  assert.equal(
    calls.some((args) => args.some((arg) => String(arg).includes("/logs"))),
    false
  )
  assert.match(calls[1].join("\n"), /annotation_level=="failure"/)
})

test("a log that comes back 404 prints the check-run annotation", () => {
  const lines = collect(
    {
      GITHUB_RUN_ID: "41545890442",
      GITHUB_REPOSITORY: "Rickvu309/opencv",
      GITHUB_TOKEN: "token",
    },
    (args) => {
      const target = args.find((arg) => String(arg).startsWith("repos/"))
      if (String(target).includes("/runs/")) return "lint\t125621292107\t1\n"
      if (String(target).includes("/logs")) {
        const error = new Error("HTTP 404")
        error.stderr = "gh: HTTP 404"
        throw error
      }
      if (String(target).includes("/annotations")) return `${billing}\n`
      throw new Error(args.join(" "))
    }
  )
  assert.deepEqual(lines, [`lint: ${billing}`])
})
