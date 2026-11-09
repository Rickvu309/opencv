import { join } from "node:path"
import { holderOf, oneLine } from "./claim-marker.mjs"
import { agentIdFor, envOf, nowOf } from "./claim.mjs"
import { prFor } from "./board.mjs"
import { TYPES } from "./fields.mjs"
import { EXIT } from "./result.mjs"
import { nextStep } from "./report.mjs"
import { locate } from "./worktree.mjs"
import { registeredWorktrees, reconcileFinished } from "./work.mjs"

const BLOCKER = /<!-- ocv-tools blocker agent=(\S+) at=(\S+) reason=(.*?) -->/

export const blockerMarker = ({ agent, at, reason }) =>
  `<!-- ocv-tools blocker agent=${agent} at=${at} reason=${oneLine(reason)} -->`

export function parseBlocker(body) {
  const m = BLOCKER.exec(String(body ?? ""))
  return m ? { agent: m[1], at: m[2], reason: m[3] } : null
}

export function blockerOf(comments, { me, serverNow }) {
  if (!me) return null
  const holder = holderOf(comments, serverNow)
  if (
    (holder.state === "live" || holder.state === "idle") &&
    holder.agent !== me
  )
    return null
  const since = Date.parse(holder.updatedAt || holder.createdAt || "")
  let found = null
  for (const c of comments ?? []) {
    const blocker = parseBlocker(c.body)
    if (!blocker || blocker.agent !== me) continue
    const posted = Date.parse(c.createdAt || "")
    if (Number.isNaN(posted)) continue
    if (!Number.isNaN(since) && posted <= since) continue
    found = blocker
  }
  return found
}

const TASK_BRANCH = new RegExp(`^(?:${TYPES.join("|")})/(\\d+)-`)

function whoAmI(ctx) {
  let gitDir = null
  try {
    gitDir = ctx.ports.git.here(ctx.cwd).gitDir
  } catch {
    gitDir = null
  }
  return agentIdFor(ctx, gitDir) ?? envOf(ctx).OCV_AGENT_ID ?? null
}

const NO_AGENT_ID =
  "done and block need to know which agent you are, and no agent id is known here. Run them from the worktree that scripts/ocv-tools.mjs take printed, or set OCV_AGENT_ID to the agent id in the claim on your issue."

export function isMine(issue, { me, serverNow }) {
  const holder = holderOf(issue.comments, serverNow)
  return (
    Boolean(me) &&
    (holder.state === "live" || holder.state === "idle") &&
    holder.agent === me
  )
}

function taskWorktrees(ctx) {
  try {
    return registeredWorktrees(ctx, locate(ctx))
      .map((w) => ({ ...w, n: Number(TASK_BRANCH.exec(w.branch ?? "")?.[1]) }))
      .filter((w) => w.n > 0)
  } catch {
    return []
  }
}

function idFileOf(ctx, path) {
  try {
    const gitDir = ctx.ports.git.here(path).gitDir
    return ctx.ports.fs.read(join(gitDir, "ocv-tools-agent")).trim() || null
  } catch {
    return null
  }
}

function describe(row) {
  const parts = []
  if (row.pr) parts.push(`pull request #${row.pr.number} open`)
  if (row.worktree) parts.push(`worktree ${row.worktree}`)
  if (row.held) parts.push(`issue held (${row.held})`)
  return `#${row.n}${row.title ? ` ${row.title}` : ""}: ${parts.join(", ")}`
}

function stepFor(row) {
  if (row.orphan) return `scripts/ocv-tools.mjs cleanup ${row.n}`
  const pr = row.pr
    ? { number: row.pr.number, state: "OPEN", isDraft: Boolean(row.pr.isDraft) }
    : null
  return nextStep({
    n: row.n,
    risk: null,
    approved: true,
    worktree: row.worktree,
    branch: row.branch,
    pr,
  })
}

export function openWork(ctx) {
  const snap = ctx.ports.gh.openBoard()
  const me = whoAmI(ctx)
  if (!me) throw new Error(NO_AGENT_ID)
  const login = ctx.ports.gh.login()
  const trees = taskWorktrees(ctx)
  const rows = new Map()
  for (const issue of snap.issues) {
    if (!isMine(issue, { me, serverNow: snap.serverNow })) continue
    const pr = prFor(snap.pulls, issue.number)
    const tree = trees.find((w) => w.n === issue.number)
    const holder = holderOf(issue.comments, snap.serverNow)
    rows.set(issue.number, {
      n: issue.number,
      title: issue.title,
      pr: pr && String(pr.state).toUpperCase() === "OPEN" ? pr : null,
      worktree: tree?.path ?? null,
      branch: tree?.branch ?? null,
      held: holder.agent,
      blocker: blockerOf(issue.comments, { me, serverNow: snap.serverNow }),
      orphan: false,
    })
  }
  for (const tree of trees) {
    if (rows.has(tree.n) || idFileOf(ctx, tree.path) !== me) continue
    let comments = []
    try {
      comments = ctx.ports.gh.comments(tree.n)
    } catch {
      comments = []
    }
    rows.set(tree.n, {
      n: tree.n,
      title: "",
      pr: null,
      worktree: tree.path,
      branch: tree.branch,
      held: null,
      blocker: blockerOf(comments, { me, serverNow: snap.serverNow }),
      orphan: true,
    })
  }
  return { me, login, rows: [...rows.values()].sort((a, b) => a.n - b.n) }
}

export function done(ctx) {
  const reconciled = reconcileFinished(ctx, [ctx.cwd])
  const { me, login, rows } = openWork(ctx)
  const open = rows.filter((row) => !row.blocker)
  const blocked = rows.filter((row) => row.blocker)
  const who = `${me} (account ${login})`
  const lines = [
    ...reconciled,
    `Open work for ${who}:`,
    "This checks only this agent's claimed issues and worktrees, not the full user request.",
  ]
  if (!rows.length) lines.push("  none")
  for (const row of open) {
    lines.push(`  ${describe(row)}`)
    lines.push(`    next: ${stepFor(row)}`)
  }
  for (const row of blocked)
    lines.push(`  blocked, ${describe(row)}: ${row.blocker.reason}`)
  if (!rows.length)
    return {
      lines: [...lines, "No open work was found for this agent."],
      next: "Verify the full user request before reporting completion.",
    }
  if (!open.length)
    return {
      exit: EXIT.human,
      lines: [
        ...lines,
        `${blocked.length} item(s) remain blocked; work is not complete.`,
      ],
      next: "Continue independent authorized work. If only an external dependency remains, arrange its wake mechanism or report the required input and resumption action. A merge restriction does not complete the request.",
    }
  return {
    exit: EXIT.error,
    lines: [...lines, `${open.length} item(s) are open with no blocker.`],
    fix: `Continue each unblocked item. Record a real external blocker with scripts/ocv-tools.mjs block <n> "<why you cannot continue>"; blocked work remains incomplete.`,
  }
}

export function block(ctx, n, reason) {
  const text = oneLine(reason ?? "")
  if (text.split(" ").length < 3)
    throw new Error(
      'usage: ocv-tools block <n> "<reason in at least three words>"'
    )
  const me = whoAmI(ctx)
  if (!me) throw new Error(NO_AGENT_ID)
  if (!ctx.ports.gh.viewIssue(n))
    throw new Error(`#${n} is not an issue. Give the issue number.`)
  const holder = holderOf(ctx.ports.gh.comments(n), ctx.ports.gh.serverNow())
  if (
    (holder.state === "live" || holder.state === "idle") &&
    holder.agent !== me
  )
    throw new Error(
      `#${n} is held by ${holder.agent}, not by you (${me}). Only the agent that holds an issue can record a blocker on it.`
    )
  const at = new Date(nowOf(ctx)).toISOString()
  ctx.ports.gh.comment(
    n,
    `${blockerMarker({ agent: me, at, reason: text })}\nocv-tools: ${me} cannot continue. Reason: ${text}`
  )
  return {
    lines: [`Recorded a blocker on #${n}: ${text}`],
    next: "scripts/ocv-tools.mjs done",
  }
}
