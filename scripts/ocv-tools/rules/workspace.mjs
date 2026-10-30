// Rules about the workstation: the task worktree, the clean main checkout,
// the assigned port, free disk and the checkout cleanup. Each check takes
// the facts a job gathered and returns a refusal, or null when the rule holds.
import { FIXES } from "../result.mjs"

function rule(spec) {
  return {
    kind: "rule",
    needs: [],
    jobs: [],
    fix: () => FIXES[spec.id],
    ...spec,
  }
}

function notATask(facts) {
  if (!facts.here || facts.here.ok) return null
  return "this folder is not a linked task worktree under ../opencv.worktrees on branch type/<n>-description"
}

function notATaskFix(facts) {
  if (facts.here?.shot)
    return "Pass --issue <n> or --pr <n>, or run shot inside the task worktree."
  return FIXES.NOT_A_TASK
}

function mainClean(facts) {
  const main = facts.main
  if (!main) return null
  const path = main.path ?? "<main>"
  if (main.readable === false)
    return `the main checkout (${path}) cannot be read as a git checkout; it stays on main and nobody works in it`
  if (main.branch !== "main")
    return `the main checkout (${path}) is on '${main.branch || "a detached HEAD"}'; it stays on main and nobody works in it`
  if (main.dirty)
    return `the main checkout (${path}) has edited files, and nobody edits there (AGENTS.md section 2): ${main.dirty}`
  return null
}

function mainFix(facts) {
  const path = facts.main?.path ?? "<main>"
  if (facts.main?.dirty)
    return `git -C '${path}' diff HEAD > ~/tmp/main-checkout-edits.patch && git -C '${path}' restore --staged --worktree .`
  return `git -C '${path}' switch main`
}

function portRule(facts) {
  const port = facts.port
  if (!port || port.recorded === false) return null
  if (port.env === port.assigned) return null
  return `PORT in ${port.worktree}/.env is '${port.env ?? "unset"}', but ocv-tools take assigned port ${port.assigned} to this worktree; use only your assigned port`
}

function portFix(facts) {
  const assigned = facts.port?.assigned ?? "<assigned>"
  const wt = facts.port?.worktree ?? "<worktree>"
  return `sed -i -E 's/^PORT=.*/PORT=${assigned}/' '${wt}/.env'`
}

function skipDeclared(facts) {
  const env = facts.env ?? {}
  if (String(env.SKIP_CHECKS ?? "") !== "1") return null
  if (env.SKIP_CHECKS_DECLARED_BY) return null
  return "SKIP_CHECKS=1 is for a production emergency a human declared; no human is named"
}

function disk(facts) {
  if (!facts.disk?.text) return null
  return facts.disk.text
}

function worktreeExists(facts) {
  if (facts.path) return `worktree path already exists: ${facts.path}`
  if (!facts.local?.worktree) return null
  return `#${facts.issue.n} already has a worktree: ${facts.local.worktree} (${facts.local.branch})`
}

function noWorktree(facts) {
  const local = facts.local
  if (!local?.required || local.found) return null
  return `#${local.n} has no local worktree under ${local.root} to clean up`
}

function dirty(facts) {
  const work = facts.work
  if (!work || work.force || !work.dirty) return null
  const preview = String(work.dirty).split("\n").slice(0, 8).join("\n")
  return `${work.path} has unsaved work:\n${preview}`
}

function notMerged(facts) {
  const work = facts.work
  if (!work || work.merged !== false) return null
  return `${work.branch} has no merged pull request`
}

function notARepo(facts) {
  const repo = facts.repo
  if (!repo || repo.ok) return null
  if (repo.bare) return `expected a non-bare repo (${repo.bare})`
  if (repo.missing) return "run this inside the opencv repository"
  return null
}

// NOT_A_TASK must stay first in the assembled table: decide stops there
// before rows whose facts a folder outside any task worktree cannot gather.
export const workspaceRows = [
  rule({
    id: "NOT_A_TASK",
    kind: "precondition",
    section: "2",
    says: "This folder must be a linked task worktree on a type and issue branch.",
    jobs: ["save", "release", "cleanup", "shot"],
    needs: ["here"],
    stop: true,
    check: notATask,
    fix: notATaskFix,
  }),
  rule({
    id: "MAIN_CLEAN",
    section: "2",
    says: "The main checkout stays on main with no edited tracked file.",
    jobs: ["open"],
    needs: ["main"],
    check: mainClean,
    fix: mainFix,
  }),
  rule({
    id: "PORT",
    section: "2",
    says: "The worktree .env keeps the port ocv-tools take assigned.",
    jobs: ["open"],
    needs: ["port"],
    check: portRule,
    fix: portFix,
  }),
  rule({
    id: "SKIP_DECLARED",
    section: "5",
    says: "SKIP_CHECKS=1 needs a human named in SKIP_CHECKS_DECLARED_BY.",
    jobs: ["open"],
    needs: ["env"],
    check: skipDeclared,
    fix: () => "env -u SKIP_CHECKS scripts/ocv-tools.mjs check",
  }),
  rule({
    id: "DISK",
    kind: "precondition",
    section: "2",
    says: "There must be enough free disk for a worktree and an install.",
    jobs: ["take"],
    needs: ["disk"],
    cause: (facts) => facts.disk?.cause,
    check: disk,
  }),
  rule({
    id: "WORKTREE_EXISTS",
    section: "2",
    says: "An issue cannot have a second worktree.",
    jobs: ["take"],
    needs: ["issue", "local"],
    check: worktreeExists,
  }),
  rule({
    id: "NO_WORKTREE",
    kind: "precondition",
    section: "6",
    says: "Cleanup needs a local worktree under the worktree root.",
    jobs: ["cleanup"],
    needs: ["local"],
    stop: true,
    check: noWorktree,
  }),
  rule({
    id: "DIRTY",
    section: "6",
    says: "Cleanup waits while the worktree has unsaved work.",
    jobs: ["cleanup"],
    needs: ["work"],
    check: dirty,
  }),
  rule({
    id: "NOT_MERGED",
    section: "6",
    says: "Cleanup waits for the queue to merge.",
    jobs: ["cleanup"],
    needs: ["work"],
    check: notMerged,
  }),
  rule({
    id: "NOT_A_REPO",
    kind: "precondition",
    section: "2",
    says: "Commands that touch a checkout run inside the opencv repository.",
    jobs: ["take", "save", "release", "cleanup"],
    needs: ["repo"],
    check: notARepo,
  }),
]
