// The one rule table. Rows live in the subject files (pull, diff, commits,
// workspace, claim, table, jobs) and only this module imports them. Every row
// has `at`, the moments it runs at (judgments run nowhere); decide(moment,
// facts) is the only way a job raises a refusal.
import { EXIT, Refused } from "../result.mjs"
import { jobRows } from "./jobs.mjs"
import { issueRows, claimRows } from "./claim.mjs"
import { pullRows } from "./pull.mjs"
import { workspaceRows } from "./workspace.mjs"
import { tableRows, judgmentRows, issueKind } from "./table.mjs"
import { diffRows } from "./diff.mjs"
import { commitRows } from "./commits.mjs"

export { issueKind, jobRows }

// The moments a rule can run at. A moment is a point in a verb where every
// fact its rows need is known; a runner gathers them and calls
// decide(moment, facts). commit and push are the git hooks, finish the PR
// opening, pr the live pull request (policy and merge), merge and queue the
// merge verb before and during the queue wait. take, take-title, take-branch
// and take-raced are the claim verb's reads and effect boundaries.
export const MOMENTS = Object.freeze([
  "commit",
  "push",
  "cli",
  "file",
  "locate",
  "issue-load",
  "history",
  "take-title",
  "take",
  "take-branch",
  "take-raced",
  "save",
  "release",
  "cleanup",
  "status",
  "approve",
  "shot",
  "shot-target",
  "finish",
  "finish-pushed",
  "pr",
  "merge",
  "merge-result",
  "queue",
])

// One runner per moment: the file that gathers the moment's facts and fires
// its rows. The git hooks are shims over the hook job. layers.test.mjs holds
// this list against the tree.
export const RUNNERS = Object.freeze({
  commit: ["scripts/ocv-tools/jobs/hook.mjs"],
  push: ["scripts/ocv-tools/jobs/hook.mjs"],
  cli: ["scripts/ocv-tools/input.mjs"],
  file: ["scripts/ocv-tools/issue.mjs"],
  locate: ["scripts/ocv-tools/worktree.mjs"],
  "issue-load": ["scripts/ocv-tools/facts.mjs"],
  history: ["scripts/ocv-tools/ports/gh.mjs"],
  "take-title": ["scripts/ocv-tools/take.mjs"],
  take: ["scripts/ocv-tools/take.mjs"],
  "take-branch": ["scripts/ocv-tools/worktree.mjs"],
  "take-raced": ["scripts/ocv-tools/take.mjs"],
  save: ["scripts/ocv-tools/work.mjs"],
  release: ["scripts/ocv-tools/claim.mjs"],
  cleanup: ["scripts/ocv-tools/work.mjs"],
  status: ["scripts/ocv-tools/report.mjs"],
  approve: ["scripts/ocv-tools/approve.mjs"],
  shot: ["scripts/ocv-tools/shot.mjs"],
  "shot-target": ["scripts/ocv-tools/shot.mjs"],
  finish: ["scripts/ocv-tools/jobs/finish.mjs"],
  "finish-pushed": ["scripts/ocv-tools/jobs/finish.mjs"],
  pr: ["scripts/ocv-tools/jobs/policy.mjs", "scripts/ocv-tools/jobs/merge.mjs"],
  merge: ["scripts/ocv-tools/jobs/merge.mjs"],
  "merge-result": ["scripts/ocv-tools/jobs/merge.mjs"],
  queue: ["scripts/ocv-tools/jobs/merge.mjs"],
})

const [notATask, ...workspaceRest] = workspaceRows
const rows = [
  notATask,
  ...jobRows,
  ...issueRows,
  ...pullRows,
  ...claimRows,
  ...workspaceRest,
  ...tableRows,
  ...diffRows,
  ...commitRows,
  ...judgmentRows,
]

export const RULES = Object.freeze(rows.map((row) => Object.freeze(row)))

// A rule is server-held when one of its moments is the live pull request.
export function layerOf(row) {
  return row.at.includes("pr") ? "server" : "local"
}

function causeOf(row, facts) {
  return typeof row.cause === "function" ? row.cause(facts) : row.cause
}

function runRow(row, facts, moment) {
  for (const kind of row.needs) {
    if (!(kind in facts))
      throw new Error(`${moment} did not gather ${kind} for ${row.id}`)
  }
  if (!row.check) return null
  const message = row.check(facts)
  if (!message) return null
  return {
    id: row.id,
    message,
    fix: row.fix(facts),
    exit: row.exit ?? "REFUSED",
    cause: causeOf(row, facts),
  }
}

// decide(moment, facts) runs that moment's rows in table order. A missing
// fact kind throws: a runner must not pass a rule by forgetting to gather it.
export function decide(moment, facts) {
  const refusals = []
  for (const row of RULES) {
    if (!row.at.includes(moment) || !row.check) continue
    const hit = runRow(row, facts, moment)
    if (!hit) continue
    refusals.push(hit)
    if (row.stop) break
  }
  return { ok: refusals.length === 0, refusals }
}

export function needsOf(moment) {
  const kinds = []
  for (const row of RULES) {
    if (!row.at.includes(moment) || !row.check) continue
    for (const kind of row.needs) if (!kinds.includes(kind)) kinds.push(kind)
  }
  return kinds
}

// Tests only: one row's verdict, to pin its message and fix. A job never calls
// this; every refusal a job raises is a row fired by decide(moment, facts).
export function evaluate(id, facts) {
  const row = RULES.find((item) => item.id === id)
  if (!row) throw new Error(`no rule ${id}`)
  return runRow(row, facts, "evaluate")
}

export function refusalError(refusal) {
  const error = new Refused(refusal.id, refusal.message, refusal.fix)
  if (refusal.exit === "HUMAN") error.exit = EXIT.human
  if (refusal.cause) error.cause = refusal.cause
  return error
}
