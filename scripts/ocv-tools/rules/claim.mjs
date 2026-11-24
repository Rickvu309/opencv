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

function notAnIssue(facts) {
  const issue = facts.issue
  if (issue && !issue.missing) return null
  if (issue?.kind === "pr") return `#${issue.n} is not a pull request`
  return `#${issue?.n ?? "?"} is not an issue`
}

function notAnIssueFix(facts) {
  if (facts.issue?.kind === "pr")
    return "Pass a pull request number to --pr. Run: gh pr list"
  if (facts.issue?.shot)
    return "Pass an issue number to --issue. Run: gh issue list"
  return FIXES.NOT_AN_ISSUE
}

function unknown(facts) {
  const h = facts.history
  if (!h || h.kind === "complete") return null
  const pull = h.list === "pull"
  const noun = pull ? "pull request" : "issue"
  const nouns = pull ? "pull requests" : "issues"
  const moved = "(the page cursor did not move)"
  const claim = (tail) => `claim history for #${h.n} ${tail}`
  const pages = h.pageCap
  if (h.kind === "board-stuck")
    return `the open ${noun} list stopped before the last page ${moved}`
  if (h.kind === "board-cap")
    return `the open ${noun} list is incomplete: ${pages} pages were read and more ${nouns} remain`
  if (h.kind === "stuck")
    return claim(`stopped before the first comment ${moved}`)
  if (h.kind === "cap")
    return claim(
      `is incomplete: ${pages} pages were read and older comments remain`
    )
  if (h.kind === "comments-open")
    return claim("did not say whether more comments exist")
  if (h.kind === "comments-cap")
    return claim(
      `is incomplete: ${pages} pages were read and more comments remain`
    )
  if (h.kind === "comments-stuck")
    return claim(`stopped before the last comment ${moved}`)
  if (h.kind === "comment-size")
    return "one picture comment is over 60000 characters"
  return null
}

function unknownFix(facts) {
  if (facts.history?.kind === "comment-size")
    return "Use a shorter --name. Run: scripts/ocv-tools.mjs help"
  return FIXES.UNKNOWN
}

function closed(facts) {
  const issue = facts.issue
  if (!issue || issue.state !== "CLOSED") return null
  if (facts.pr) {
    const state = facts.pr.current?.state ?? facts.pr.state
    if (state === "MERGED") return null
  }
  return `#${issue.n} is closed${facts.report ? `\n${facts.report}` : ""}`
}

function assigned(facts) {
  const issue = facts.issue
  if (!issue || facts.flags?.["--take"]) return null
  const login = String(facts.login ?? "")
  const others = (issue.assignees ?? []).filter(
    (name) => name.toLowerCase() !== login.toLowerCase()
  )
  if (!others.length) return null
  return `#${issue.n} is assigned to ${others.join(", ")}; pick another issue, or pass --take if this is agreed`
}

function notOwner(facts) {
  if (facts.pull) {
    const author = String(facts.pull.author ?? "")
    const me = String(facts.me ?? "")
    if (author.toLowerCase() === me.toLowerCase()) return null
    return `PR #${facts.pull.n} is by ${author}, not ${me}.`
  }
  return null
}

function branchExists(facts) {
  const branch = facts.branch
  if (!branch || branch.stage !== "create") return null
  const name = branch.name
  if (!branch.resume && branch.local)
    return `branch ${name} already exists locally (git worktree list)`
  if (!branch.resume && branch.remote)
    return `branch ${name} already exists on origin; someone is already working on it`
  if (branch.resume && !branch.local && !branch.remote)
    return `branch ${name} is not on origin, so there is nothing to resume`
  return null
}

function branchFix(facts) {
  const branch = facts.branch ?? {}
  const n = facts.issue?.n ?? "<n>"
  if (branch.resume && !branch.local && !branch.remote)
    return `scripts/ocv-tools.mjs take ${n}`
  if (!branch.resume && branch.local) return FIXES.BRANCH_EXISTS
  if (!branch.resume && branch.remote)
    return `scripts/ocv-tools.mjs take ${n} --resume`
  return FIXES.BRANCH_EXISTS
}

function diverged(facts) {
  const branch = facts.branch
  if (!branch || branch.relation !== "diverged") return null
  return `local ${branch.name} and origin/${branch.name} have diverged, so resume would keep the stale local history`
}

function divergedFix(facts) {
  const name = facts.branch?.name ?? "<branch>"
  const n = facts.issue?.n ?? "<n>"
  return `Keep both tips. In the main checkout: git fetch origin ${name} && git log --oneline --left-right ${name}...origin/${name}; reconcile, then: scripts/ocv-tools.mjs take ${n} --resume`
}

export const issueRows = [
  rule({
    id: "NOT_AN_ISSUE",
    kind: "precondition",
    section: "1",
    says: "The number must be an issue, not a pull request.",
    at: ["issue-load", "shot-target"],
    needs: ["issue"],
    stop: true,
    check: notAnIssue,
    fix: notAnIssueFix,
  }),
  rule({
    id: "UNKNOWN",
    kind: "precondition",
    section: "1",
    says: "Issue comments and board pages must be read completely before an owner is named.",
    at: ["issue-load", "history", "shot-target"],
    needs: ["history"],
    stop: true,
    check: unknown,
    fix: unknownFix,
  }),
  rule({
    id: "CLOSED",
    section: "1",
    says: "A closed issue is not a task, unless its pull request is already merged.",
    at: ["take", "finish"],
    needs: ["issue"],
    stop: true,
    check: closed,
  }),
]

export const claimRows = [
  rule({
    id: "ASSIGNED",
    section: "1",
    says: "Do not take an issue assigned to someone else unless --take was agreed.",
    at: ["take"],
    needs: ["issue", "login", "flags"],
    check: assigned,
  }),
  rule({
    id: "NOT_OWNER",
    kind: "precondition",
    section: "2",
    says: "Only the author of a pull request merges it.",
    at: ["merge"],
    needs: ["me"],
    check: notOwner,
  }),
  rule({
    id: "BRANCH_EXISTS",
    section: "3",
    says: "Do not create a branch that already exists locally or on origin.",
    at: ["take-branch"],
    needs: ["branch", "issue"],
    check: branchExists,
    fix: branchFix,
  }),
  rule({
    id: "DIVERGED",
    section: "3",
    says: "Resume refuses when the local branch and origin have diverged.",
    at: ["take-branch"],
    needs: ["branch", "issue"],
    check: diverged,
    fix: divergedFix,
  }),
]
