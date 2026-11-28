import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import {
  RED_LIMIT,
  attemptLine,
  main,
  mainRedActions,
  redCommits,
  redRateLine,
  redReport,
  rerunCommand,
} from "./main-red.mjs"

const RED = "a".repeat(40)
const PARENT = "b".repeat(40)
const GREEN = "c".repeat(40)
const OLD_GREEN = "d".repeat(40)
const RUN = "https://github.com/o/r/actions/runs/7"

const ciText = readFileSync(
  new URL("../.github/workflows/ci.yml", import.meta.url),
  "utf8"
)

function job(name) {
  const start = ciText.search(new RegExp(`^  ${name}:\\s*$`, "m"))
  assert.notEqual(start, -1, `${name} job exists`)
  const rest = ciText.slice(start + 1)
  const next = rest.search(/^ {2}[a-z][a-z0-9-]*:\s*$/m)
  return next === -1 ? rest : rest.slice(0, next)
}

function world({ listed = [], ancestors = {}, runs = [] } = {}) {
  const calls = []
  const io = {
    gh(args) {
      calls.push(["gh", ...args])
      if (args[0] === "issue" && args[1] === "list")
        return JSON.stringify(listed)
      if (args[0] === "run" && args[1] === "list") return JSON.stringify(runs)
      return ""
    },
    git(args) {
      calls.push(["git", ...args])
      if (args[0] === "rev-parse") return `${PARENT}\n`
      if (args[0] === "merge-base") {
        if (ancestors[args[3]]?.includes(args[2])) return ""
        throw new Error("not an ancestor")
      }
      throw new Error(`unscripted git ${args.join(" ")}`)
    },
    out: () => {},
  }
  return { io, calls }
}

const env = (result, sha, attempt = 2) => ({
  CI_RESULT: result,
  GITHUB_SHA: sha,
  RUN_URL: RUN,
  RUN_ATTEMPT: String(attempt),
})

test("a first failed run on main opens and comments on nothing, because the failed jobs run again by themselves", () => {
  const { io, calls } = world({
    listed: [
      {
        number: 9,
        body: redReport({ sha: PARENT, parent: OLD_GREEN, runUrl: RUN }),
        comments: [],
      },
    ],
  })
  const lines = []
  main(env("failure", RED, 1), { ...io, out: (line) => lines.push(line) })
  assert.deepEqual(
    calls.filter(
      (call) => call[0] === "gh" && call[1] === "issue" && call[2] !== "list"
    ),
    []
  )
  assert.match(lines.join("\n"), /attempt 1; the failed jobs run again once/)
})

test("a red run on main opens one main-red issue with the commit, the run and the revert command", () => {
  const { io, calls } = world()
  main(env("failure", RED), io)
  const created = calls.find(
    (call) => call[1] === "issue" && call[2] === "create"
  )
  assert.ok(created, "an issue is opened")
  assert.equal(created[created.indexOf("--label") + 1], "main-red")
  const body = created[created.indexOf("--body") + 1]
  assert.ok(body.includes(`Red commit: ${RED}`))
  assert.match(body, /^Run: https:\/\/github\.com\/o\/r\/actions\/runs\/7$/m)
  assert.ok(
    body.includes(
      `node scripts/production-revert.mjs ${RED} --good ${PARENT} --apply`
    )
  )
  assert.doesNotMatch(body, /[\u00b7\u2014]/)
})

test("a second red run comments on the open issue instead of opening another", () => {
  const { io, calls } = world({
    listed: [
      {
        number: 9,
        body: redReport({ sha: PARENT, parent: OLD_GREEN, runUrl: RUN }),
        comments: [],
      },
    ],
  })
  main(env("failure", RED), io)
  assert.equal(calls.filter((call) => call[2] === "create").length, 0)
  const comment = calls.find((call) => call[2] === "comment")
  assert.equal(comment[3], "9")
  assert.match(
    comment[comment.indexOf("--body") + 1],
    new RegExp(`Red commit: ${RED}`)
  )
})

test("a green run that contains every red commit closes the issue", () => {
  const { io, calls } = world({
    listed: [
      {
        number: 9,
        body: redReport({ sha: PARENT, parent: OLD_GREEN, runUrl: RUN }),
        comments: [
          { body: redReport({ sha: RED, parent: PARENT, runUrl: RUN }) },
        ],
      },
    ],
    ancestors: { [GREEN]: [PARENT, RED] },
  })
  main(env("success", GREEN), io)
  const closed = calls.find((call) => call[2] === "close")
  assert.ok(closed, "the issue is closed")
  assert.equal(closed[3], "9")
})

test("a green run from before the red commit leaves the issue open", () => {
  const actions = mainRedActions({
    result: "success",
    sha: OLD_GREEN,
    parent: null,
    runUrl: RUN,
    open: [{ number: 9, redCommits: [RED] }],
    contains: () => false,
  })
  assert.deepEqual(actions, [{ do: "keep", number: 9, missing: [RED] }])
})

test("a cancelled run and a green run with nothing open change nothing", () => {
  const base = { sha: GREEN, parent: null, runUrl: RUN, contains: () => true }
  assert.deepEqual(
    mainRedActions({
      ...base,
      result: "cancelled",
      open: [{ number: 9, redCommits: [] }],
    }),
    []
  )
  assert.deepEqual(mainRedActions({ ...base, result: "success", open: [] }), [])
  const { io, calls } = world()
  main(env("success", GREEN), io)
  assert.deepEqual(
    calls.map((call) => call.slice(0, 3).join(" ")),
    ["gh issue list"]
  )
})

test("the report names the command that runs the failed jobs again", () => {
  assert.equal(rerunCommand({ runUrl: RUN }), "gh run rerun 7 --failed")
  assert.equal(rerunCommand({ runUrl: "" }), null)
  const text = redReport({ sha: RED, parent: PARENT, runUrl: RUN })
  assert.match(text, /^gh run rerun 7 --failed$/m)
  assert.doesNotMatch(
    redReport({ sha: RED, parent: PARENT, runUrl: "" }),
    /gh run rerun/
  )
})

test("red commits are read from the body and every comment once", () => {
  const text = redReport({ sha: RED, parent: PARENT, runUrl: RUN })
  assert.deepEqual(redCommits([text, text, "Red commit: short", null]), [RED])
})

test("ci runs the main-red report after ci on every push to main, with write access to issues only", () => {
  const report = job("main-red")
  assert.match(report, /^ {4}needs: ci$/m)
  assert.match(
    report,
    /^ {4}if: \$\{\{ always\(\) && github\.event_name == 'push' && github\.ref == 'refs\/heads\/main' \}\}$/m
  )
  assert.match(report, /^ {6}CI_RESULT: \$\{\{ needs\.ci\.result \}\}$/m)
  assert.match(report, /^ {6}issues: write$/m)
  assert.doesNotMatch(report, /contents: write|pull-requests: write|write-all/)
  assert.match(report, /fetch-depth: 0/)
  assert.match(report, /run: node scripts\/main-red\.mjs/)
})

const nightlyText = readFileSync(
  new URL("../.github/workflows/nightly.yml", import.meta.url),
  "utf8"
)
const rerunText = nightlyText.slice(nightlyText.indexOf("  rerun-main-once:"))

test("the red rate counts a failed run and a run that needed a second attempt, and names the limit only when it is passed", () => {
  const green = { conclusion: "success", attempt: 1 }
  const red = { conclusion: "failure", attempt: 1 }
  const healed = { conclusion: "success", attempt: 2 }
  const within = [red, healed, red, ...Array(27).fill(green)]
  assert.equal(
    redRateLine(within),
    "Main went red in 3 of its last 30 runs. The limit is 3 in 30."
  )
  const over = redRateLine([red, ...within])
  assert.match(over, /^Main went red in 4 of its last 30 runs\./)
  assert.match(over, /That is over the limit/)
  assert.match(over, /docs\/adr\/0003-merge-is-a-production-deploy\.md/)
  assert.deepEqual(RED_LIMIT, { runs: 30, red: 3 })
})

test("a first failure says the run goes again by itself, and a second failure says it is not chance", () => {
  assert.match(attemptLine(1), /run again once by themselves/)
  assert.match(attemptLine(2), /attempt 2.*not a chance failure/)
})

test("a red run on main reports the attempt and the red rate from the last runs on main", () => {
  const green = { conclusion: "success", attempt: 1 }
  const { io, calls } = world({ runs: Array(29).fill(green) })
  main({ ...env("failure", RED), RUN_ATTEMPT: "2" }, io)
  const listedRuns = calls.find(
    (call) => call[1] === "run" && call[2] === "list"
  )
  assert.ok(listedRuns, "the last runs on main are read")
  assert.ok(listedRuns.includes("push") && listedRuns.includes("main"))
  const created = calls.find(
    (call) => call[1] === "issue" && call[2] === "create"
  )
  const body = created[created.indexOf("--body") + 1]
  assert.match(body, /^This is attempt 2:/m)
  assert.match(body, /^Main went red in 1 of its last 30 runs\./m)
})

test("a failed run on main is run again once, by a job that can do nothing else and never fails", () => {
  assert.match(
    nightlyText,
    /^ {2}workflow_run:\n {4}workflows: \[Checks\]\n {4}types: \[completed\]\n {4}branches: \[main\]$/m
  )
  assert.match(
    rerunText,
    /^ {4}if: \$\{\{ github\.event_name == 'workflow_run' && github\.event\.workflow_run\.event == 'push' && github\.event\.workflow_run\.head_branch == 'main' && github\.event\.workflow_run\.conclusion == 'failure' && github\.event\.workflow_run\.run_attempt == 1 \}\}$/m
  )
  assert.match(rerunText, /^ {4}continue-on-error: true$/m)
  assert.match(nightlyText, /^permissions: \{\}$/m)
  assert.match(rerunText, /^ {4}permissions:\n {6}actions: write\n {4}env:/m)
  assert.doesNotMatch(rerunText, /contents: write|issues: write|write-all/)
  assert.match(rerunText, /run: gh run rerun "\$RUN_ID" --failed$/m)
  assert.doesNotMatch(rerunText, /actions\/checkout/)
})
