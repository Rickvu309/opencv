import { EXIT, Refused } from "../result.mjs"
import { jobRows } from "./jobs.mjs"
import { issueRows, claimRows } from "./claim.mjs"
import { pullRows } from "./pull.mjs"
import { workspaceRows } from "./workspace.mjs"
import { tableRows, judgmentRows, issueKind } from "./table.mjs"
import { diffRows } from "./diff.mjs"
import { commitRows } from "./commits.mjs"

export { issueKind, jobRows }

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

const LIVE_PULL_REQUEST = "pr"

export function layerOf(row) {
  return row.at.includes(LIVE_PULL_REQUEST) ? "server" : "local"
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
