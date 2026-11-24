import { EXIT, Refused } from "../result.mjs"
import { jobRows } from "./jobs.mjs"
import { issueRows, claimRows } from "./claim.mjs"
import { pullRows } from "./pull.mjs"
import { workspaceRows } from "./workspace.mjs"
import { tableRows, judgmentRows, issueKind } from "./table.mjs"
import { diffRows } from "./diff.mjs"
import { commitRows } from "./commits.mjs"
import { protectedRows } from "./protected.mjs"

export { issueKind, jobRows }
export {
  LABELS,
  allowMigrationLabel,
  allowedMigrationTags,
  openProductionRed,
  mergeGateFiles,
  ownerBecause,
} from "./merge-gate.mjs"

export const MOMENTS = Object.freeze({
  commit: "The pre-commit hook, before git records the commit.",
  push: "The pre-push hook, before git sends the branch.",
  cli: "Any verb, once its words and flags are parsed.",
  file: "Filing an issue, once its body is read.",
  locate: "Any verb, once it has found the repository it runs in.",
  "issue-load": "Any verb that names an issue, once the issue is read.",
  history: "Reading a branch's past pull requests from GitHub.",
  "take-title":
    "Taking a new title, before the issue exists; only the disk is known, so a full disk makes no GitHub call.",
  take: "Taking an issue, once the issue, its claim and the disk are read, before anything changes.",
  "take-branch":
    "Taking an issue, once the local and remote branch are compared.",
  "take-raced":
    "Taking an issue, after the claim is written and read back, to catch a second taker.",
  save: "Saving work in a task worktree.",
  release: "Giving back a claim on an issue.",
  cleanup: "Removing a task worktree and its branch after the merge.",
  shot: "Attaching pictures as evidence, once the files are read.",
  "shot-target":
    "Attaching pictures, once the issue or pull request they go to is read.",
  authoring:
    "Checking issue and pull request metadata before taking, saving or finishing work.",
  finish: "Opening the pull request, before the push.",
  "finish-pushed": "Opening the pull request, after the push.",
  body: "Replacing a pull request body, once the new text is read.",
  retire:
    "The retire verb, once it has read what the branch weakens and run the replacement test's flip proof.",
  pr: "The live pull request, read by the policy check in ci and by the merge verb.",
  merge: "The merge verb, before it enqueues the pull request.",
  "merge-result":
    "The merge verb, once it knows whether the branch merges with main and the merged tree passes.",
  queue: "The merge verb, while it waits on the merge queue.",
})

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
  shot: ["scripts/ocv-tools/shot.mjs"],
  "shot-target": ["scripts/ocv-tools/shot.mjs"],
  authoring: ["scripts/ocv-tools/authoring.mjs"],
  finish: ["scripts/ocv-tools/jobs/finish.mjs"],
  "finish-pushed": ["scripts/ocv-tools/jobs/finish.mjs"],
  body: ["scripts/ocv-tools/jobs/body.mjs"],
  retire: ["scripts/ocv-tools/jobs/retire.mjs"],
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
  ...protectedRows,
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
