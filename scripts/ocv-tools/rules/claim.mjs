// Rules about taking and holding an issue: the claim, the assignee, the
// branch. Each check takes the facts a job gathered and returns a refusal,
// or null when the rule holds.
import { CLAIM_IDLE_MINUTES } from "../claim-marker.mjs"
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

function holds(claim, me) {
  return (
    Boolean(me) &&
    claim?.agent === me &&
    claim.state !== "none" &&
    claim.state !== "released"
  )
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

function notHighRisk(facts) {
  const issue = facts.issue
  if (!issue || issue.risk === "high") return null
  return `#${issue.n} is ${issue.risk ?? "unset"} risk, so no approval is needed`
}

function notHighRiskFix(facts) {
  const n = facts.issue?.n ?? "<n>"
  return `No approval is needed. Run: scripts/ocv-tools.mjs take ${n}`
}

function held(facts) {
  const claim = facts.claim
  if (!claim || claim.state !== "live" || claim.agent === facts.me) return null
  return `#${facts.issue.n} is held by ${claim.agent} (last saved ${claim.idleMinutes} min ago; free after ${CLAIM_IDLE_MINUTES})`
}

function needsApproval(facts) {
  const issue = facts.issue
  if (!issue || issue.risk !== "high" || issue.approved) return null
  return `#${issue.n} is risk:high and the owner has not posted an unedited /approve after its last edit`
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
  if (facts.account && facts.issue) {
    const me = String(facts.account.login ?? "").trim()
    const approvers = (facts.account.approvers ?? []).map((login) =>
      String(login).toLowerCase()
    )
    if (approvers.includes(me.toLowerCase())) return null
    return `signed in as ${me || "nobody"}, without admin rights to approve #${facts.issue.n}`
  }
  if (!facts.claim || !facts.issue) return null
  if (holds(facts.claim, facts.me)) return null
  const who = facts.claim.agent ? `; ${facts.claim.agent} does` : ""
  return `you (${facts.me ?? "no agent id"}) do not hold #${facts.issue.n}${who}`
}

function notOwnerFix(facts) {
  if (facts.account)
    return "run this as an account with admin rights on the project"
  return FIXES.NOT_OWNER
}

function lost(facts) {
  if (!facts.claim || !facts.issue) return null
  if (holds(facts.claim, facts.me)) return null
  return facts.claim.agent
    ? `${facts.claim.agent} holds the claim now`
    : "you no longer hold the claim"
}

function branchExists(facts) {
  const branch = facts.branch
  if (!branch || branch.stage !== "create") return null
  const name = branch.name
  if (!branch.resume && branch.local)
    return `branch ${name} already exists locally (git worktree list)`
  if (!branch.resume && branch.remote)
    return branch.held?.state === "idle"
      ? `the idle holder ${branch.held.agent} already pushed branch ${name}`
      : `branch ${name} already exists on origin; someone is already working on it`
  if (branch.resume && !branch.local && !branch.remote)
    return `branch ${name} is not on origin, so there is nothing to resume`
  return null
}

function branchFix(facts) {
  const branch = facts.branch ?? {}
  const n = facts.issue?.n ?? "<n>"
  if (branch.resume && !branch.local && !branch.remote)
    return `scripts/ocv-tools.mjs take ${n}`
  // Same order as branchExists: a local tip wins, even when origin has it too.
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

// The issue gates run before the pull rows: a closed or missing issue stops
// the take before READY_FOR_HUMAN can speak for it.
export const issueRows = [
  rule({
    id: "NOT_AN_ISSUE",
    kind: "precondition",
    section: "1",
    says: "The number must be an issue, not a pull request.",
    jobs: ["take", "status", "save", "release", "shot"],
    needs: ["issue"],
    stop: true,
    check: notAnIssue,
    fix: notAnIssueFix,
  }),
  rule({
    id: "UNKNOWN",
    kind: "precondition",
    section: "1",
    says: "Claim history and board pages must be complete before a holder is decided.",
    jobs: ["take", "status", "save", "release", "board", "shot"],
    needs: ["history"],
    stop: true,
    check: unknown,
    fix: unknownFix,
  }),
  rule({
    id: "CLOSED",
    section: "1",
    says: "A closed issue is not a task, unless its pull request is already merged.",
    jobs: ["take", "status", "approve"],
    needs: ["issue"],
    stop: true,
    check: closed,
  }),
  rule({
    id: "NOT_HIGH_RISK",
    kind: "precondition",
    section: "1",
    says: "Approve is only for a risk:high issue. Any other risk needs no approval.",
    jobs: ["approve"],
    needs: ["issue"],
    stop: true,
    check: notHighRisk,
    fix: notHighRiskFix,
  }),
]

export const claimRows = [
  rule({
    id: "HELD",
    section: "2",
    says: "Never take an issue another agent saved within the last 180 minutes.",
    jobs: ["take"],
    needs: ["issue", "claim", "me"],
    check: held,
  }),
  rule({
    id: "NEEDS_APPROVAL",
    section: "1",
    says: "A risk:high issue needs a fresh unedited owner /approve after its last edit.",
    jobs: ["take"],
    needs: ["issue"],
    check: needsApproval,
  }),
  rule({
    id: "ASSIGNED",
    section: "1",
    says: "Do not take an issue assigned to someone else unless --take was agreed.",
    jobs: ["take"],
    needs: ["issue", "login", "flags"],
    check: assigned,
  }),
  rule({
    id: "NOT_OWNER",
    kind: "precondition",
    section: "2",
    says: "Only the holding agent can release an issue, and only a project admin can approve one.",
    jobs: ["release", "approve"],
    needs: ["claim", "me", "issue"],
    check: notOwner,
    fix: notOwnerFix,
  }),
  rule({
    id: "LOST",
    kind: "precondition",
    section: "2",
    says: "Stop when another agent holds the claim, and keep the work as a patch.",
    jobs: ["save"],
    needs: ["claim", "me", "issue"],
    exit: "LOST",
    check: lost,
  }),
  rule({
    id: "BRANCH_EXISTS",
    section: "3",
    says: "Do not create a branch that already exists locally or on origin.",
    jobs: ["take"],
    needs: ["branch", "issue"],
    check: branchExists,
    fix: branchFix,
  }),
  rule({
    id: "DIVERGED",
    section: "3",
    says: "Resume refuses when the local branch and origin have diverged.",
    jobs: ["take"],
    needs: ["branch", "issue"],
    check: diverged,
    fix: divergedFix,
  }),
]
