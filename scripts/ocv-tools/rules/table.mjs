import { jobRows } from "./jobs.mjs"
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

function notATaskFix(facts) {
  if (facts.here?.shot)
    return "Pass --issue <n> or --pr <n>, or run shot inside the task worktree."
  return FIXES.NOT_A_TASK
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
  if (args.shot) return "pass --pr or --issue, not both"
  return args.both
    ? "pass an issue number or a title, not both"
    : `expected one target, got ${args.count}`
}

function badArgsFix(facts) {
  if (facts.args?.shot)
    return "Pass one of --pr or --issue. Run: scripts/ocv-tools.mjs help"
  return FIXES.BAD_ARGS
}

const PICTURE_BYTES = 10 * 1024 * 1024

function missingFile(facts) {
  const p = facts.picture
  if (!p || p.exists !== false) return null
  return `${p.path} does not exist`
}

function badPicture(facts) {
  const p = facts.picture
  if (!p) return null
  const bad = `${p.path} is not a png, jpg, gif or webp`
  if (p.file === false) return bad
  if (p.bytesChecked === false) return `${bad} (checked the file bytes)`
  if (p.asset) return `two files would be named ${p.asset}`
  return null
}

function badPictureFix(facts) {
  if (facts.picture?.asset)
    return "Pass --name, or rename one file so the pictures stay distinct."
  return FIXES.BAD_PICTURE
}

function tooBig(facts) {
  const p = facts.picture
  if (!p || p.bytes == null || p.bytes <= PICTURE_BYTES) return null
  return `${p.path} is over 10 MB`
}

function tooMany(facts) {
  const count = facts.shot?.count
  if (count == null || count <= 20) return null
  return `shot takes at most 20 pictures per run (${count} given)`
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
  ...jobRows,
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
    id: "MISSING_FIELDS",
    kind: "precondition",
    section: "1",
    says: "A task needs its type, title, description and the flags the command asked for.",
    jobs: ["file", "take", "cli", "shot"],
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
    jobs: ["cli", "shot"],
    needs: ["flag"],
    check: unknownFlag,
  }),
  rule({
    id: "BAD_ARGS",
    kind: "precondition",
    says: "Pass one target, an issue number or a title.",
    jobs: ["cli", "shot"],
    needs: ["args"],
    check: badArgs,
    fix: badArgsFix,
  }),
  rule({
    id: "BAD_ISSUE",
    kind: "precondition",
    says: "An issue target must be a whole number of 1 or more.",
    jobs: ["cli"],
    needs: ["token"],
    check: badIssue,
  }),
  rule({
    id: "MISSING_FILE",
    kind: "precondition",
    says: "A picture passed to shot must exist on disk.",
    jobs: ["shot"],
    needs: ["picture"],
    stop: true,
    check: missingFile,
  }),
  rule({
    id: "BAD_PICTURE",
    kind: "precondition",
    says: "A shot picture must be a png, jpg, gif or webp, with its own name.",
    jobs: ["shot"],
    needs: ["picture"],
    stop: true,
    check: badPicture,
    fix: badPictureFix,
  }),
  rule({
    id: "TOO_BIG",
    kind: "precondition",
    says: "A shot picture must be 10 MB or smaller.",
    jobs: ["shot"],
    needs: ["picture"],
    stop: true,
    check: tooBig,
  }),
  rule({
    id: "TOO_MANY",
    kind: "precondition",
    says: "Shot takes at most 20 pictures in one run.",
    jobs: ["shot"],
    needs: ["shot"],
    stop: true,
    check: tooMany,
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
