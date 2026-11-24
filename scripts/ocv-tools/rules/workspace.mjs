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

function affectedTests(facts) {
  if (String(facts.env?.SKIP_CHECKS ?? "") === "1") return null
  const affected = facts.affected ?? {}
  if (affected.unreadable?.length)
    return `the tool could not read what this change is, so no pass is recorded: ${affected.unreadable.slice(0, 3).join("; ")}`
  if (affected.failed?.length)
    return `the tests this change reaches failed: ${affected.failed.join(", ")}`
  if (affected.unproved?.length)
    return `${affected.unproved.length} changed file(s) need more than the tests a push runs, so no pass is recorded: ${affected.unproved.slice(0, 8).join(", ")}${affected.unproved.length > 8 ? ", ..." : ""}`
  if (affected.receipt === false)
    return `no passing run of the tests this change reaches is recorded for ${String(affected.head ?? "HEAD").slice(0, 12)}`
  return null
}

const CANNOT_RUN_HERE =
  'If a test cannot run on this machine at all, record it with scripts/ocv-tools.mjs block <issue> "<reason>"; SKIP_CHECKS=1 stays for a production emergency a human declared'

function affectedTestsFix(facts) {
  const failed = facts.affected?.failed ?? []
  if (facts.affected?.unreadable?.length)
    return `Do what the refusal names for that file or read, then run scripts/ocv-tools.mjs check in this worktree; unknown never counts as passed. ${CANNOT_RUN_HERE}`
  if (failed.some((label) => label.includes("not installed")))
    return `Run pnpm install in this worktree, then scripts/ocv-tools.mjs check. ${CANNOT_RUN_HERE}`
  if (facts.affected?.unproved?.length)
    return `Run scripts/ocv-tools.mjs check in this worktree: it runs the tests this change reaches plus ${(facts.affected.proofs ?? []).join(" and ")}, then records the pass; push again after it. ${CANNOT_RUN_HERE}`
  if (failed.length)
    return `Fix the failing tests the output names, then run scripts/ocv-tools.mjs check: it reruns only this set and records the pass. If they fail with "Cannot find module '@workspace/...'" or "Failed to resolve import", build the package it names first: pnpm --filter <that package> build. ${CANNOT_RUN_HERE}`
  return `Run scripts/ocv-tools.mjs check in this worktree: it runs the tests this change reaches and records the pass for this commit. ${CANNOT_RUN_HERE}`
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
    at: ["save", "release", "cleanup", "shot", "finish"],
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
    at: ["push", "finish"],
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
    id: "AFFECTED_TESTS",
    section: "4",
    says: "A push records a local pre-check pass, never a claim that all tests pass; CI is the gate. The pass needs the tests the change reaches: changed tests, tests that scan a changed folder, and every test that imports a changed file directly or through other files. Past 40 such tests in a package, it runs the changed tests, the folder scanners and the 25 nearest (tests that name a changed command or import or sit beside a changed file), records a partial pass that names how many ran, and leaves the rest to CI. A config, setup, package or other broad change records a broad pass that names the suite CI runs. No path runs a whole suite unless check --all asks. One local run at a time holds a machine-wide lock while its tests run. Every changed file is accounted for by those tests, by the package suite CI runs when only folder scanners read it, by a short no-tests list, or by a larger run that check performs. Anything the tool cannot read, parse or classify, a skip-worktree or assume-unchanged entry, and a .only in a changed test refuse the pass. Finish needs that pass recorded for the head commit and tree.",
    at: ["push", "finish"],
    needs: ["affected", "env"],
    check: affectedTests,
    fix: affectedTestsFix,
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
