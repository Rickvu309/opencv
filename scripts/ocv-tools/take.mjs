// take: do the whole start-of-work job in Node (it replaces scripts/new-task.sh). Checks the
// issue, makes the branch and worktree, assigns the issue, records the claim comment and writes
// the workflow result file (script "new-task").
import { basename, join } from "node:path"
import { EXIT, FIXES, Refused, gh } from "./core.mjs"
import { TYPES } from "./fields.mjs"
import { CLAIM_IDLE_MINUTES } from "./claim-marker.mjs"
import {
  claimBody,
  envAgent,
  envOf,
  newAgent,
  nowOf,
  readClaim,
} from "./claim.mjs"
import { diskProblem } from "./disk.mjs"
import { file } from "./issue.mjs"
import { worktreeFor } from "./report.mjs"
import { writeResult } from "./result.mjs"
import {
  createWorktree,
  descFromTitle,
  discardWorktree,
  locate,
} from "./worktree.mjs"

function repoName(ctx) {
  try {
    return basename(locate(ctx).main)
  } catch {
    return "unknown"
  }
}

const bodyType = (body) =>
  TYPES.find((t) => new RegExp(`^### Type\\s+${t}\\s*$`, "m").test(body ?? ""))

// A title instead of a number files the issue first (the plain-words lint applies).
function fileFirst(ctx, title, flags) {
  const filed = file(ctx, { flags: { ...flags, "--title": title } })
  const first = filed.lines[0] ?? ""
  const m = /#(\d+)/.exec(first)
  if (!m || /DRY RUN/.test(first)) return { done: filed }
  return { n: Number(m[1]) }
}

export function take(ctx, target, flags = {}) {
  const startedAt = new Date(nowOf(ctx)).toISOString()
  let id = String(target)
  const done = (status, extra) => {
    const path = writeResult(envOf(ctx), {
      script: "new-task",
      repo: repoName(ctx),
      id,
      status,
      startedAt,
      ...extra,
    })
    return path ? `RESULT_JSON: ${path}` : null
  }
  try {
    const r = takeInner(ctx, target, flags, (v) => (id = v))
    if (r.noResult) return r
    if (r.exit === EXIT.LOST)
      return {
        ...r,
        tail: done("fail", { cause: "other", detail: r.lines[0] }),
      }
    return { ...r, tail: done("ok", { detail: r.lines[0], next: r.next }) }
  } catch (error) {
    error.tail = done("fail", {
      cause: error.cause ?? "hygiene",
      detail: error.message,
    })
    throw error
  }
}

function ensureDisk(ctx) {
  const { main, root } = locate(ctx)
  const problem = diskProblem(envOf(ctx), { main, root })
  if (!problem) return
  const e = new Refused("DISK", problem.text)
  e.cause = problem.cause
  throw e
}

function heldError(n, h) {
  return new Refused(
    "HELD",
    `#${n} is held by ${h.agent} (last saved ${h.idleMinutes} min ago; free after ${CLAIM_IDLE_MINUTES})`
  )
}

// GitHub has no atomic claim: issue comments are not a compare-and-swap.
// take re-reads after install and after posting; the newest live marker wins.
// save re-reads again immediately before push. A comment that arrives after
// that last read can still win. That gap is the residual race.
function lostTake(ctx, made, n, h) {
  const removed = discardWorktree(ctx, made)
  return {
    exit: EXIT.LOST,
    lines: [
      `LOST #${n}: ${h.agent ? `${h.agent} holds the claim now` : "you no longer hold the claim"}.`,
      removed
        ? "The new worktree had no changes, so it was removed."
        : `The worktree was kept: ${made.worktree}`,
      "Stop working on this issue.",
    ],
    fix: FIXES.LOST,
  }
}

function takeInner(ctx, target, flags, setId) {
  let n = Number(String(target).replace(/^#/, ""))
  if (!Number.isInteger(n) || n < 1) {
    // A title files an issue. Check the disk before that write, so a full
    // disk makes zero GitHub calls.
    ensureDisk(ctx)
    const filed = fileFirst(ctx, String(target), flags)
    if (filed.done) {
      return { ...filed.done, noResult: true }
    }
    n = filed.n
  }
  const {
    issue,
    labels,
    risk,
    type,
    approved,
    holder: held,
  } = readClaim(ctx, n)
  const kind = flags["--type"] ?? type ?? bodyType(issue.body)
  setId(`${kind ?? "task"}-${n}`)
  if (issue.state === "CLOSED") throw new Refused("CLOSED", `#${n} is closed`)
  if (labels.includes("ready-for-human"))
    throw new Refused(
      "READY_FOR_HUMAN",
      `#${n} is labeled ready-for-human: it is a decision for a human, never an agent task`
    )
  const me = envAgent(ctx) ?? newAgent()
  if (held.state === "live" && held.agent !== me) throw heldError(n, held)
  if (risk === "high" && !approved)
    throw new Refused(
      "NEEDS_APPROVAL",
      `#${n} is risk:high and the owner has not commented /approve after its last edit`
    )
  const login = ctx.run("gh", ["api", "user", "--jq", ".login"]).out
  const others = (issue.assignees?.nodes ?? [])
    .map((a) => a.login)
    .filter((a) => a.toLowerCase() !== login.toLowerCase())
  if (others.length && !flags["--take"])
    throw new Refused(
      "ASSIGNED",
      `#${n} is assigned to ${others.join(", ")}; pick another issue, or pass --take if this is agreed`
    )
  const existing = worktreeFor(ctx, n)
  if (existing.worktree)
    throw new Refused(
      "WORKTREE_EXISTS",
      `#${n} already has a worktree: ${existing.worktree} (${existing.branch})`
    )
  if (!kind)
    throw new Refused(
      "MISSING_FIELDS",
      `#${n} has no Type (${TYPES.join(", ")})`
    )

  // After the reads above, before the worktree and the claim comment.
  ensureDisk(ctx)
  const made = createWorktree(ctx, {
    type: kind,
    issue: n,
    desc: flags["-d"] ?? descFromTitle(issue.title),
    install: !flags["--no-install"],
    resume: Boolean(flags["--resume"]),
    held,
  })
  const observed = readClaim(ctx, n)
  const mid = observed.holder
  if (mid.state === "live" && mid.agent !== me) {
    discardWorktree(ctx, made)
    throw heldError(n, mid)
  }
  const at = new Date(observed.serverNow).toISOString()
  try {
    gh(
      ctx,
      "issue",
      "comment",
      String(n),
      "--body",
      claimBody({ agent: me, at, branch: made.branch })
    )
  } catch (e) {
    throw new Error(
      `worktree ${made.worktree} is ready but the claim could not be recorded: ${e.message}`
    )
  }
  const won = readClaim(ctx, n).holder
  if (!(won.state === "live" && won.agent === me))
    return lostTake(ctx, made, n, won)
  if (!flags["--no-assign"]) {
    const a = ctx.run("gh", [
      "issue",
      "edit",
      String(n),
      "--add-assignee",
      "@me",
    ])
    if (!a.ok) made.warnings.push(`could not assign #${n} to you`)
  }
  if (!envAgent(ctx))
    ctx.writeFile(join(made.gitDir, "ocv-tools-agent"), `${me}\n`)
  setId(made.branch)
  return {
    lines: [
      `Took #${n} ${issue.title}${held.state === "idle" ? ` (took over idle claim of ${held.agent})` : ""}`,
      `Worktree: ${made.worktree}`,
      `Branch: ${made.branch}`,
      `Port: ${made.port} (api on ${made.port}, web on ${made.port + 1000})`,
      `Agent: ${me}`,
      ...made.warnings.map((w) => `Warning: ${w}`),
    ],
    next: `cd ${made.worktree}, do the work, run scripts/ocv-tools.mjs save -m "<what you did>" at least every ${CLAIM_IDLE_MINUTES} minutes, then scripts/open-pr.sh --draft`,
  }
}
