// Every workflow rule. id is the refusal code. decide() runs the rows whose
// jobs include the command, in this order. A bash rule keeps its function in
// scripts/lib/rules.sh and records impl: "bash:rule_<name>".
import { CLAIM_IDLE_MINUTES } from "../claim-marker.mjs"
import { TYPES } from "../fields.mjs"
import { FIXES } from "../result.mjs"
import { bashRows } from "./bash.mjs"

const TYPE_LIST = TYPES.join(", ")
const MAX_WORDS = 5

export function issueKind(issue, flags = {}) {
  if (flags["--type"]) return flags["--type"]
  if (issue?.type) return issue.type
  const body = issue?.body ?? ""
  return (
    TYPES.find((t) => new RegExp(`^### Type\\s+${t}\\s*$`, "m").test(body)) ??
    null
  )
}

function slugOf(text) {
  return String(text ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .split("-")
    .slice(0, MAX_WORDS)
    .join("-")
}

function holds(claim, me) {
  return (
    Boolean(me) &&
    claim?.agent === me &&
    claim.state !== "none" &&
    claim.state !== "released"
  )
}

function notATask(facts) {
  if (!facts.here || facts.here.ok) return null
  return "this folder is not a linked task worktree under ../opencv.worktrees on branch type/<n>-description"
}

function notAnIssue(facts) {
  const issue = facts.issue
  if (issue && !issue.missing) return null
  return `#${issue?.n ?? "?"} is not an issue`
}

function unknown(facts) {
  const history = facts.history
  if (!history || history.kind === "complete") return null
  if (history.kind === "stuck")
    return `claim history for #${history.n} stopped before the first comment (the page cursor did not move)`
  if (history.kind === "cap")
    return `claim history for #${history.n} is incomplete: ${history.pageCap} pages were read and older comments remain`
  return null
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

function readyForHuman(facts) {
  const issue = facts.issue
  if (!issue?.labels?.includes("ready-for-human")) return null
  return `#${issue.n} is labeled ready-for-human: it is a decision for a human, never an agent task`
}

function held(facts) {
  const claim = facts.claim
  if (!claim || claim.state !== "live" || claim.agent === facts.me) return null
  return `#${facts.issue.n} is held by ${claim.agent} (last saved ${claim.idleMinutes} min ago; free after ${CLAIM_IDLE_MINUTES})`
}

function needsApproval(facts) {
  const issue = facts.issue
  if (!issue || issue.risk !== "high" || issue.approved) return null
  return `#${issue.n} is risk:high and the owner has not commented /approve after its last edit`
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
  if (!facts.claim || !facts.issue) return null
  if (holds(facts.claim, facts.me)) return null
  const who = facts.claim.agent ? `; ${facts.claim.agent} does` : ""
  return `you (${facts.me ?? "no agent id"}) do not hold #${facts.issue.n}${who}`
}

function lost(facts) {
  if (!facts.claim || !facts.issue) return null
  if (holds(facts.claim, facts.me)) return null
  return facts.claim.agent
    ? `${facts.claim.agent} holds the claim now`
    : "you no longer hold the claim"
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

function missingFields(facts) {
  if (facts.missingValue) return `${facts.missingValue} needs a value`
  const draft = facts.draft
  if (draft?.missingTitle) return "no --title"
  if (draft?.titleError) return draft.titleError
  if (draft?.badTitle)
    return `the title must start with one of ${TYPE_LIST} and a colon, for example "fix: ..."`
  if (draft?.bodyError) return draft.bodyError
  if (facts.requireKind && !issueKind(facts.issue, facts.flags ?? {}))
    return `#${facts.issue.n} has no Type (${TYPE_LIST})`
  if ("desc" in facts && !slugOf(facts.desc ?? ""))
    return `description "${facts.desc}" has no usable characters; pass -d`
  if (typeof facts.type === "string" && !TYPES.includes(facts.type))
    return `type must be one of: ${TYPE_LIST}`
  if (
    facts.validateType &&
    facts.flags?.["--type"] != null &&
    !TYPES.includes(facts.flags["--type"])
  )
    return `type must be one of: ${TYPE_LIST}`
  return null
}

function unreadable(facts) {
  const reasons = facts.draft?.reasons
  if (!reasons?.length) return null
  return reasons.join("; ")
}

function disk(facts) {
  if (!facts.disk?.text) return null
  return facts.disk.text
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
  return `Keep both tips. From the main checkout run: git fetch origin ${name} && git log --oneline --left-right ${name}...origin/${name}. Reconcile them, then run: scripts/ocv-tools.mjs take ${n} --resume`
}

function notARepo(facts) {
  const repo = facts.repo
  if (!repo || repo.ok) return null
  if (repo.bare) return `expected a non-bare repo (${repo.bare})`
  if (repo.missing) return "run this inside the opencv repository"
  return null
}

function unknownCommand(facts) {
  const command = facts.command
  if (!command || command.known) return null
  return `no command "${command.name}"; commands are ${command.names}`
}

function unknownFlag(facts) {
  const flag = facts.flag
  if (!flag || flag.known) return null
  return flag.hint
    ? `unknown option: ${flag.name} (use ${flag.hint})`
    : `unknown option: ${flag.name}`
}

function badArgs(facts) {
  const args = facts.args
  if (!args || args.ok) return null
  return args.both
    ? "pass an issue number or a title, not both"
    : `expected one target, got ${args.count}`
}

function badIssue(facts) {
  const token = facts.token
  if (!token || token.ok) return null
  return `"${token.text}" is not an issue number`
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

function judgment(spec) {
  return {
    kind: "judgment",
    jobs: [],
    needs: [],
    check: null,
    fix: () => "None",
    ...spec,
  }
}

const rows = [
  rule({
    id: "NOT_A_TASK",
    kind: "precondition",
    section: "2",
    says: "This folder must be a linked task worktree on a type and issue branch.",
    jobs: ["save", "release", "cleanup"],
    needs: ["here"],
    stop: true,
    check: notATask,
  }),
  rule({
    id: "NOT_AN_ISSUE",
    kind: "precondition",
    section: "1",
    says: "The number must be an issue, not a pull request.",
    jobs: ["take", "status", "save", "release"],
    needs: ["issue"],
    stop: true,
    check: notAnIssue,
  }),
  rule({
    id: "UNKNOWN",
    kind: "precondition",
    section: "1",
    says: "Claim history must be complete before a holder is decided.",
    jobs: ["take", "status", "save", "release"],
    needs: ["history"],
    stop: true,
    check: unknown,
  }),
  rule({
    id: "CLOSED",
    section: "1",
    says: "A closed issue is not a task, unless its pull request is already merged.",
    jobs: ["take", "status"],
    needs: ["issue"],
    stop: true,
    check: closed,
  }),
  rule({
    id: "READY_FOR_HUMAN",
    section: "5",
    says: "An issue labeled ready-for-human is a decision for a human, never an agent task.",
    jobs: ["take", "open"],
    needs: ["issue"],
    check: readyForHuman,
    impl: "bash:rule_not_ready_for_human",
  }),
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
    says: "A risk:high issue needs an owner /approve comment after its last edit.",
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
    says: "Only the agent that holds the issue can release it.",
    jobs: ["release"],
    needs: ["claim", "me", "issue"],
    check: notOwner,
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
    says: "Cleanup waits until the pull request is merged.",
    jobs: ["cleanup"],
    needs: ["work"],
    check: notMerged,
  }),
  rule({
    id: "MISSING_FIELDS",
    kind: "precondition",
    section: "1",
    says: "A task needs its type, title, description and the flags the command asked for.",
    jobs: ["file", "take", "cli"],
    needs: ["flags"],
    stop: true,
    check: missingFields,
  }),
  rule({
    id: "UNREADABLE",
    section: "1",
    says: "Plain sections must stay readable: short words, no jargon, no file names.",
    jobs: ["file"],
    needs: ["draft"],
    check: unreadable,
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
  rule({
    id: "NOT_A_REPO",
    kind: "precondition",
    section: "2",
    says: "Commands that touch a checkout run inside the opencv repository.",
    jobs: ["take", "save", "release", "cleanup"],
    needs: ["repo"],
    check: notARepo,
  }),
  rule({
    id: "UNKNOWN_COMMAND",
    kind: "precondition",
    says: "The command must be one of the jobs help lists.",
    jobs: ["cli"],
    needs: ["command"],
    check: unknownCommand,
  }),
  rule({
    id: "UNKNOWN_FLAG",
    kind: "precondition",
    says: "A flag must be one this command accepts.",
    jobs: ["cli"],
    needs: ["flag"],
    check: unknownFlag,
  }),
  rule({
    id: "BAD_ARGS",
    kind: "precondition",
    says: "Pass one target, an issue number or a title.",
    jobs: ["cli"],
    needs: ["args"],
    check: badArgs,
  }),
  rule({
    id: "BAD_ISSUE",
    kind: "precondition",
    says: "An issue target must be a whole number of 1 or more.",
    jobs: ["cli"],
    needs: ["token"],
    check: badIssue,
  }),
  ...bashRows,
  judgment({
    id: "OTHER_WORKTREE",
    section: "2",
    says: "Never touch another agent's worktree.",
    why: "Git records no agent identity, so nothing tells whose hands edited a worktree.",
  }),
  judgment({
    id: "SPLIT_SUBISSUES",
    section: "1",
    says: "Split long work into sub-issues.",
    why: "A size judgment. Nothing measures it.",
  }),
  judgment({
    id: "VERIFY_BY_HAND",
    section: "4",
    says: "Verify the change by hand before marking a pull request ready.",
    why: "Run a verify skill by hand. Nothing checks it at merge.",
  }),
  judgment({
    id: "OWN_IDENTITY",
    section: "5",
    says: "Never approve with another identity.",
    why: "One account. GitHub cannot tell two agents apart.",
  }),
  judgment({
    id: "CLEANUP_BY_HAND",
    section: "6",
    says: "Remove the worktree after the merge.",
    why: "ocv-tools cleanup is run by hand.",
  }),
]

export const RULES = Object.freeze(rows.map((row) => Object.freeze(row)))
