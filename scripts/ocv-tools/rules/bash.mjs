// Rules whose check still runs in scripts/lib/rules.sh. The pure check here is
// what the table, the guide and the row tests use. open-pr.sh and merge-pr.sh
// are unchanged.
import { FIXES } from "../result.mjs"

function asLines(value) {
  if (Array.isArray(value)) return value
  if (value == null || value === "") return []
  return String(value).split("\n").filter(Boolean)
}

function rule(spec) {
  return {
    kind: "rule",
    needs: [],
    jobs: [],
    fix: () => FIXES[spec.id],
    ...spec,
  }
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

function workflowFiles(facts) {
  return asLines(facts.diff?.files)
}

function noWorkflows(facts) {
  const bad = workflowFiles(facts).filter(
    (file) =>
      file.startsWith(".github/workflows/") &&
      file !== ".github/workflows/ci.yml"
  )
  if (!bad.length) return null
  return `workflows other than ci.yml are not added without an issue: ${bad.slice(0, 3).join(" ")}`
}

function ciKept(facts) {
  if (!workflowFiles(facts).includes(".github/workflows/ci.yml")) return null
  if (facts.diff?.ciYmlAtHead !== false) return null
  return "the change deletes .github/workflows/ci.yml: the file may change, never vanish (the required ci check runs from it)"
}

function riskHigh(facts) {
  const watched = [
    ".github/workflows/ci.yml",
    "scripts/check.mjs",
    "scripts/check.mjs",
    ".github/rulesets/main.json",
  ]
  if (
    !workflowFiles(facts).some(
      (file) => watched.includes(file) || file.startsWith(".github/actions/")
    )
  )
    return null
  if (asLines(facts.diff?.labels).includes("risk:high")) return null
  return "the change touches ci.yml, composite actions, check.mjs or the main ruleset, which attest the ci check itself, and the issue is not labeled risk:high (owner approval, slice 5 of epic #582)"
}

function skipDeclared(facts) {
  const env = facts.env ?? {}
  if (String(env.SKIP_CHECKS ?? "") !== "1") return null
  if (env.SKIP_CHECKS_DECLARED_BY) return null
  return "SKIP_CHECKS=1 is for a production emergency a human declared; no human is named"
}

function skipSaid(facts) {
  const pull = facts.pull
  if (!pull || pull.stamp !== "skip") return null
  const found = String(pull.body ?? "").match(
    /(?:^|[,(*] *)emergency declared by [^ \t*.,;)<>]+/i
  )
  const who = found ? found[0].replace(/^.*emergency declared by /i, "") : ""
  if (who && who.toLowerCase() !== "unknown") return null
  const sha = String(pull.sha ?? "").slice(0, 9)
  return `head ${sha} was pushed with SKIP_CHECKS=1 (only for an emergency a human declared) and PR #${pull.pr} does not say "emergency declared by <name>"`
}

function pushed(facts) {
  const commits = facts.commits
  if (!commits || commits.stampDir === false || commits.stamp) return null
  const sha = String(commits.sha ?? "").slice(0, 9)
  return `commit ${sha} has no pre-push stamp: it was pushed without the pre-push hook (the hook-skip flag, or a branch cut before the stamping hook landed, whose worktree still runs the old .githooks/pre-push)`
}

function commitsHooked(facts) {
  const commits = facts.commits
  if (!commits) return null
  if (commits.trailers)
    return `commit(s) ${String(commits.trailers).trim()} carry an attribution trailer, which the commit-msg hook refuses: they were made without that hook (the hook-skip flag, a cherry-pick or a rebase)`
  if (commits.oversize)
    return `file(s) over the 20000-byte pre-commit limit: ${String(commits.oversize).trim()}; a commit this size passes only with the hook-skip flag. Split each file as .githooks/pre-commit says, then run the fix`
  return null
}

function commitsFix(facts) {
  if (facts.commits?.oversize)
    return 'git add -A && git commit -m "fix: split oversize files under the 20000-byte limit"'
  return 'git reset --soft "$(git merge-base origin/main HEAD)" && git commit -m "$(git log -1 --format=%s ORIG_HEAD)" && git push --force-with-lease'
}

export const bashRows = [
  rule({
    id: "MAIN_CLEAN",
    section: "2",
    says: "The main checkout stays on main with no edited tracked file.",
    jobs: ["open"],
    needs: ["main"],
    check: mainClean,
    fix: mainFix,
    impl: "bash:rule_main_clean",
  }),
  rule({
    id: "PORT",
    section: "2",
    says: "The worktree .env keeps the port ocv-tools take assigned.",
    jobs: ["open"],
    needs: ["port"],
    check: portRule,
    fix: portFix,
    impl: "bash:rule_port",
  }),
  rule({
    id: "NO_WORKFLOWS",
    section: "5",
    says: "Only ci.yml is a workflow; .github/actions/setup/** is allowed.",
    jobs: ["open"],
    needs: ["diff"],
    check: noWorkflows,
    fix: () => "git rm -rf -- <files> && git commit --amend --no-edit",
    impl: "bash:rule_no_workflows",
  }),
  rule({
    id: "CI_WORKFLOW_KEPT",
    section: "5",
    says: "ci.yml may change but never vanish.",
    jobs: ["open", "merge"],
    needs: ["diff"],
    check: ciKept,
    fix: () =>
      "git checkout origin/main -- .github/workflows/ci.yml && git commit --amend --no-edit",
    impl: "bash:rule_ci_workflow_kept",
  }),
  rule({
    id: "RISK_HIGH_FOR_CI",
    section: "5",
    says: "A change to ci.yml, a composite action, checks or the main ruleset needs the risk:high label.",
    jobs: ["merge"],
    needs: ["diff"],
    check: riskHigh,
    fix: () => "gh issue edit <issue> --add-label risk:high",
    impl: "bash:rule_risk_high_for_ci",
  }),
  rule({
    id: "SKIP_DECLARED",
    section: "5",
    says: "SKIP_CHECKS=1 needs a human named in SKIP_CHECKS_DECLARED_BY.",
    jobs: ["open"],
    needs: ["env"],
    check: skipDeclared,
    fix: () => "env -u SKIP_CHECKS scripts/open-pr.sh",
    impl: "bash:rule_skip_declared",
  }),
  rule({
    id: "SKIP_SAID",
    section: "5",
    says: "A head pushed with SKIP_CHECKS=1 names the human in the pull request body.",
    jobs: ["open"],
    needs: ["pull"],
    check: skipSaid,
    fix: () =>
      "gh api -X PATCH repos/{owner}/{repo}/pulls/<pr> -f body='SKIP_CHECKS=1, emergency declared by <who>.'",
    impl: "bash:rule_skip_said",
  }),
  rule({
    id: "PUSHED_THROUGH_HOOK",
    section: "5",
    says: "A pushed commit has a pre-push stamp.",
    jobs: ["open"],
    needs: ["commits"],
    check: pushed,
    fix: () =>
      "git fetch origin main && git rebase origin/main && git commit --amend --no-edit && git push --force-with-lease",
    impl: "bash:rule_pushed_through_hook",
  }),
  rule({
    id: "COMMITS_HOOKED",
    section: "5",
    says: "Commits on the branch pass the commit-msg and pre-commit hooks.",
    jobs: ["open"],
    needs: ["commits"],
    check: commitsHooked,
    fix: commitsFix,
    impl: "bash:rule_commits_hooked",
  }),
]
