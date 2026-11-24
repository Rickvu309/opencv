import { BRANCH_RE, TYPES } from "../fields.mjs"
import { FIXES } from "../result.mjs"

function rule(spec) {
  return {
    kind: "rule",
    needs: [],
    at: [],
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
    return `the main checkout (${path}) has edited files, and nobody edits there (AGENTS.md): ${main.dirty}`
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

function noPushMain(facts) {
  const hit = (facts.push?.refs ?? []).find((ref) => ref.branch === "main")
  if (!hit) return null
  return `${hit.deleting ? "deleting" : "pushing to"} main is not allowed`
}

const BOT_BRANCH = /^(dependabot|renovate)\//

function branchName(facts) {
  const bad = (facts.push?.refs ?? []).find(
    (ref) =>
      ref.branch != null &&
      ref.branch !== "main" &&
      !ref.deleting &&
      !BRANCH_RE.test(ref.branch) &&
      !BOT_BRANCH.test(ref.branch)
  )
  if (!bad) return null
  return `branch '${bad.branch}' does not match type/<issue#>-short-description (types: ${TYPES.join(", ")})`
}

function quickChecks(facts) {
  const failed = facts.quick?.failed ?? []
  if (!failed.length) return null
  return `the quick checks failed: ${failed.join(", ")}`
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
  const preview = String(work.dirty)
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line) => line.trim())
    .slice(0, 8)
    .join("; ")
  return `${work.path} has unsaved work: ${preview}`
}

function dirtyFix(facts) {
  if (facts.work?.finish)
    return "Commit the changes, then run scripts/ocv-tools.mjs finish again."
  return FIXES.DIRTY
}

function notMerged(facts) {
  const work = facts.work
  if (!work || work.merged !== false || work.abandoned) return null
  return `${work.branch} has no merged pull request or explicitly abandoned closed pull request`
}

function notARepo(facts) {
  const repo = facts.repo
  if (!repo || repo.ok) return null
  if (repo.bare) return `expected a non-bare repo (${repo.bare})`
  if (repo.missing) return "run this inside the opencv repository"
  return null
}

export const workspaceRows = [
  rule({
    id: "NOT_A_TASK",
    kind: "precondition",
    section: "2",
    says: "This folder must be a linked task worktree on a type and issue branch.",
    at: ["save", "cleanup", "shot", "finish"],
    needs: ["here"],
    stop: true,
    check: notATask,
    fix: notATaskFix,
  }),
  rule({
    id: "MAIN_CLEAN",
    section: "2",
    says: "The main checkout stays on main with no edited tracked file.",
    at: ["finish"],
    needs: ["main"],
    check: mainClean,
    fix: mainFix,
  }),
  rule({
    id: "PORT",
    section: "2",
    says: "The worktree .env keeps the port ocv-tools take assigned.",
    at: ["finish"],
    needs: ["port"],
    check: portRule,
    fix: portFix,
  }),
  rule({
    id: "SKIP_DECLARED",
    section: "5",
    says: "SKIP_CHECKS=1 needs a human named in SKIP_CHECKS_DECLARED_BY.",
    at: ["push"],
    needs: ["env"],
    check: skipDeclared,
    fix: () =>
      "unset SKIP_CHECKS, or name the human who declared the emergency in SKIP_CHECKS_DECLARED_BY",
  }),
  rule({
    id: "NO_PUSH_MAIN",
    section: "5",
    says: "Nothing is pushed to main or deletes it; main changes only through a merged pull request.",
    at: ["push"],
    needs: ["push"],
    check: noPushMain,
    fix: () =>
      "Push your task branch and open a PR: scripts/ocv-tools.mjs finish --body-file <file>",
  }),
  rule({
    id: "BRANCH_NAME",
    section: "3",
    says: "A pushed branch is named type/<issue#>-short-description (bot branches dependabot/ and renovate/ pass).",
    at: ["push"],
    needs: ["push"],
    check: branchName,
    fix: () =>
      "Rename it: git branch -m type/<issue#>-short-description (see docs/git-workflow/branch-naming.md)",
  }),
  rule({
    id: "QUICK_CHECKS",
    section: "4",
    says: "A push passes the quick checks: prettier and eslint on the changed files, a typecheck of each changed package and the packages that use it, and no comments. The guard suite runs on GitHub.",
    at: ["push"],
    needs: ["quick"],
    check: quickChecks,
    fix: () =>
      "Fix what the checks printed and push again; pnpm check runs the larger local suite",
  }),
  rule({
    id: "DISK",
    kind: "precondition",
    section: "2",
    says: "There must be enough free disk for a worktree and an install.",
    at: ["take-title", "take", "finish"],
    needs: ["disk"],
    cause: (facts) => facts.disk?.cause,
    check: disk,
  }),
  rule({
    id: "WORKTREE_EXISTS",
    section: "2",
    says: "An issue cannot have a second worktree.",
    at: ["take"],
    needs: ["issue", "local", "path"],
    check: worktreeExists,
  }),
  rule({
    id: "NO_WORKTREE",
    kind: "precondition",
    section: "6",
    says: "Cleanup needs a local worktree under the worktree root.",
    at: ["cleanup"],
    needs: ["local"],
    stop: true,
    check: noWorktree,
  }),
  rule({
    id: "DIRTY",
    section: "6",
    says: "Cleanup waits while the worktree has unsaved work.",
    at: ["cleanup", "finish"],
    needs: ["work"],
    check: dirty,
    fix: dirtyFix,
  }),
  rule({
    id: "NOT_MERGED",
    section: "6",
    says: "Cleanup waits for the pull request to merge.",
    at: ["cleanup"],
    needs: ["work"],
    check: notMerged,
  }),
  rule({
    id: "NOT_A_REPO",
    kind: "precondition",
    section: "2",
    says: "Commands that touch a checkout run inside the opencv repository.",
    at: ["locate"],
    needs: ["repo"],
    check: notARepo,
  }),
]
