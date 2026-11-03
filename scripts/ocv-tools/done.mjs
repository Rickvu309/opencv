import { join } from "node:path"
import { holderOf, parseMarker } from "./claim-marker.mjs"
import { agentIdFor, nowOf } from "./claim.mjs"
import { prFor } from "./board.mjs"
import { TYPES } from "./fields.mjs"
import { EXIT } from "./result.mjs"
import { nextStep } from "./report.mjs"
import { locate } from "./worktree.mjs"

const BLOCKER = /<!-- ocv-tools blocker agent=(\S+) at=(\S+) reason=(.*?) -->/

const oneLine = (text) =>
  String(text).replace(/\s+/g, " ").replaceAll("-->", "--").trim()

export const blockerMarker = ({ agent, at, reason }) =>
  `<!-- ocv-tools blocker agent=${agent} at=${at} reason=${oneLine(reason)} -->`

export function parseBlocker(body) {
  const m = BLOCKER.exec(String(body ?? ""))
  return m ? { agent: m[1], at: m[2], reason: m[3] } : null
}

export function blockerOf(comments) {
  let claimAt = -1
  let found = null
  let foundAt = -1
  ;(comments ?? []).forEach((c, index) => {
    if (parseMarker(c.body)?.kind === "claim") claimAt = index
    const blocker = parseBlocker(c.body)
    if (blocker) {
      found = blocker
      foundAt = index
    }
  })
  return foundAt > claimAt ? found : null
}

const TASK_BRANCH = new RegExp(`^(?:${TYPES.join("|")})/(\\d+)-`)

function whoAmI(ctx) {
  let gitDir = null
  try {
    gitDir = ctx.ports.git.here(ctx.cwd).gitDir
  } catch {
    gitDir = null
  }
  return agentIdFor(ctx, gitDir)
}

export function isMine(issue, { me, login, serverNow }) {
  const holder = holderOf(issue.comments, serverNow)
  if (holder.state === "released") return false
  if (me) return holder.agent === me && holder.state !== "none"
  return (issue.assignees ?? []).includes(login)
}

function taskWorktrees(ctx) {
  try {
    const { root } = locate(ctx)
    return ctx.ports.git
      .worktrees(ctx.cwd)
      .filter((w) => w.path.startsWith(`${root}/`))
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
  const login = ctx.ports.gh.login()
  const trees = taskWorktrees(ctx)
  const rows = new Map()
  for (const issue of snap.issues) {
    if (!isMine(issue, { me, login, serverNow: snap.serverNow })) continue
    const pr = prFor(snap.pulls, issue.number)
    const tree = trees.find((w) => w.n === issue.number)
    const holder = holderOf(issue.comments, snap.serverNow)
    rows.set(issue.number, {
      n: issue.number,
      title: issue.title,
      pr: pr && String(pr.state).toUpperCase() === "OPEN" ? pr : null,
      worktree: tree?.path ?? null,
      branch: tree?.branch ?? null,
      held: holder.state === "none" ? `assigned to ${login}` : holder.agent,
      blocker: blockerOf(issue.comments),
      orphan: false,
    })
  }
  for (const tree of trees) {
    if (rows.has(tree.n) || !me || idFileOf(ctx, tree.path) !== me) continue
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
      blocker: blockerOf(comments),
      orphan: true,
    })
  }
  return { me, login, rows: [...rows.values()].sort((a, b) => a.n - b.n) }
}

export function done(ctx) {
  const { me, login, rows } = openWork(ctx)
  const open = rows.filter((row) => !row.blocker)
  const blocked = rows.filter((row) => row.blocker)
  const who = me
    ? `${me} (account ${login})`
    : `account ${login} (no agent id here, so everything assigned to it counts)`
  const lines = [`Open work for ${who}:`]
  if (!rows.length) lines.push("  none")
  for (const row of open) {
    lines.push(`  ${describe(row)}`)
    lines.push(`    next: ${stepFor(row)}`)
  }
  for (const row of blocked)
    lines.push(`  blocked, ${describe(row)}: ${row.blocker.reason}`)
  if (!open.length)
    return {
      lines: [...lines, "Nothing is open without a recorded blocker."],
      next: "Report what you finished.",
    }
  return {
    exit: EXIT.error,
    lines: [...lines, `${open.length} item(s) are open with no blocker.`],
    fix: `Finish each item, or run scripts/ocv-tools.mjs block <n> "<why you cannot continue>".`,
  }
}

export function block(ctx, n, reason) {
  const text = oneLine(reason ?? "")
  if (text.split(" ").length < 3)
    throw new Error(
      'usage: ocv-tools block <n> "<reason in at least three words>"'
    )
  if (!ctx.ports.gh.viewIssue(n))
    throw new Error(`#${n} is not an issue. Give the issue number.`)
  const me = whoAmI(ctx) ?? "unknown"
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
