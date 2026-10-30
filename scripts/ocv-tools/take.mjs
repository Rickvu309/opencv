// take: do the whole start-of-work job in Node (it replaces scripts/new-task.sh). Checks the
// issue, makes the branch and worktree, assigns the issue, records the claim comment and writes
// the workflow result file (script "new-task").
import { basename, join } from "node:path"
import { EXIT, FIXES, writeResult } from "./result.mjs"
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
import { lazyFacts } from "./lazy.mjs"
import { decide, issueKind, refusalError } from "./rules/index.mjs"
import {
  createWorktree,
  descFromTitle,
  discardWorktree,
  locate,
  takenPath,
} from "./worktree.mjs"

function repoName(ctx) {
  try {
    return basename(locate(ctx).main)
  } catch {
    return "unknown"
  }
}

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
    if (r.exit === EXIT.lost)
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

function diskOf(ctx) {
  const { main, root } = locate(ctx)
  return diskProblem(ctx.ports.fs, envOf(ctx), { main, root }) ?? {}
}

// A title is filed before there is an issue to read, so only the disk can
// refuse yet. A full disk makes zero GitHub calls.
function checkDiskFirst(ctx) {
  const verdict = decide("take-title", { disk: diskOf(ctx) })
  if (!verdict.ok) throw refusalError(verdict.refusals[0])
}

// The take decision. Reads a closed issue never needs (the login, the
// worktree list, the disk) happen only when a row asks for them.
function decideTake(ctx, n, { issue, held, me, flags, kind }) {
  const desc = flags["-d"] ?? descFromTitle(issue.title)
  const facts = lazyFacts(
    { issue, claim: held, me, flags, requireKind: true, desc, type: kind },
    {
      login: () => ctx.ports.gh.login(),
      local: () => {
        const existing = worktreeFor(ctx, n)
        return { worktree: existing.worktree, branch: existing.branch }
      },
      disk: () => diskOf(ctx),
      path: () => takenPath(ctx, n, desc),
    }
  )
  const verdict = decide("take", facts)
  if (!verdict.ok) throw refusalError(verdict.refusals[0])
}

// GitHub has no atomic claim: issue comments are not a compare-and-swap.
// take re-reads after install and after posting; the newest live marker wins.
// save refreshes the claim immediately before push, then re-reads after the
// push returns and does not report success if the holder changed. A comment
// that arrives after that post-push read can still win. That gap is the
// residual race.
function lostTake(ctx, made, n, h) {
  const removed = discardWorktree(ctx, made)
  return {
    exit: EXIT.lost,
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
    checkDiskFirst(ctx)
    const filed = fileFirst(ctx, String(target), flags)
    if (filed.done) {
      return { ...filed.done, noResult: true }
    }
    n = filed.n
  }
  const { issue, holder: held } = readClaim(ctx, n)
  const kind = issueKind(issue, flags)
  setId(`${kind ?? "task"}-${n}`)
  const me = envAgent(ctx) ?? newAgent()
  decideTake(ctx, n, { issue, held, me, flags, kind })
  const made = createWorktree(ctx, {
    type: kind,
    issue: n,
    desc: flags["-d"] ?? descFromTitle(issue.title),
    install: !flags["--no-install"],
    resume: Boolean(flags["--resume"]),
    held,
  })
  const observed = readClaim(ctx, n, true)
  const mid = observed.holder
  const raced = decide("take-raced", { issue, claim: mid, me })
  if (!raced.ok) {
    discardWorktree(ctx, made)
    throw refusalError(raced.refusals[0])
  }
  const at = new Date(observed.serverNow).toISOString()
  try {
    ctx.ports.gh.comment(n, claimBody({ agent: me, at, branch: made.branch }))
  } catch (e) {
    throw new Error(
      `worktree ${made.worktree} is ready but the claim could not be recorded: ${e.message}`
    )
  }
  const won = readClaim(ctx, n, true).holder
  if (!(won.state === "live" && won.agent === me))
    return lostTake(ctx, made, n, won)
  if (!flags["--no-assign"]) {
    if (!ctx.ports.gh.assignMe(n))
      made.warnings.push(`could not assign #${n} to you`)
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
    next: `cd ${made.worktree}, do the work, run scripts/ocv-tools.mjs save -m "<what you did>" at least every ${CLAIM_IDLE_MINUTES} minutes, then scripts/ocv-tools.mjs finish --body-file <file>`,
  }
}
