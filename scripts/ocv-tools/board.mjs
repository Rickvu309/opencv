import { holderOf } from "./claim-marker.mjs"
import { approvalValid, riskOf } from "./facts.mjs"
import { TYPES } from "./fields.mjs"

const FAILING = new Set([
  "FAILURE",
  "TIMED_OUT",
  "CANCELLED",
  "ERROR",
  "STARTUP_FAILURE",
  "ACTION_REQUIRED",
])

const GROUPS = [
  ["waiting", "Waiting for approval"],
  ["free", "Open and free"],
  ["taken", "Taken"],
  ["idle", "Idle (past 180 min)"],
  ["inReview", "In review"],
]

export function checkState(rollup) {
  const list = Array.isArray(rollup) ? rollup : []
  if (!list.length) return "none"
  const failing = (c) =>
    FAILING.has(c?.conclusion) ||
    c?.state === "FAILURE" ||
    c?.state === "ERROR" ||
    c?.state === "CANCELLED"
  if (list.some(failing)) return "failing"
  const pending = (c) =>
    (c?.status && c.status !== "COMPLETED") ||
    c?.state === "PENDING" ||
    c?.state === "EXPECTED"
  if (list.some(pending)) return "pending"
  return "passing"
}

export function groupOf({ risk, approved, claim, prOpen }) {
  if (risk === "high" && !approved) return "waiting"
  if (prOpen) return "inReview"
  if (claim === "live") return "taken"
  if (claim === "idle") return "idle"
  return "free"
}

export function prFor(prs, n) {
  const prefix = new RegExp(`^(?:${TYPES.join("|")})/${n}-`)
  const mine = (prs ?? []).filter((pr) =>
    prefix.test(String(pr.headRefName ?? ""))
  )
  return (
    mine.find((pr) => String(pr.state).toUpperCase() === "OPEN") ??
    mine[0] ??
    null
  )
}

function latestCi(runs) {
  let best = null
  let bestAt = -1
  for (const run of runs) {
    const at = Date.parse(run?.started_at || run?.completed_at || "")
    const stamp = Number.isNaN(at) ? 0 : at
    if (!best || stamp >= bestAt) {
      best = run
      bestAt = stamp
    }
  }
  return best
}

function checksFor(gh, pr) {
  if (!pr?.headRefOid) return pr ? "none" : null
  const best = latestCi(gh.checkRuns(pr.headRefOid))
  if (!best) return "none"
  return checkState([
    {
      status: String(best.status ?? "").toUpperCase(),
      conclusion: best.conclusion
        ? String(best.conclusion).toUpperCase()
        : null,
    },
  ])
}

function idleMinutes(holder) {
  if (holder.state !== "live" && holder.state !== "idle") return null
  return Number.isFinite(holder.idleMinutes) ? holder.idleMinutes : null
}

function rowFrom(issue, approvers, serverNow, pr, checks) {
  const labels = issue.labels ?? []
  const risk = riskOf(labels, issue.body ?? "")
  const approved = approvalValid({
    comments: issue.comments,
    approvers,
    lastEditedAt: issue.lastEditedAt,
    createdAt: issue.createdAt,
  })
  const holder = holderOf(issue.comments, serverNow)
  const open = Boolean(pr) && String(pr.state).toUpperCase() === "OPEN"
  const group = groupOf({
    risk,
    approved,
    claim: holder.state,
    prOpen: open,
  })
  return {
    number: issue.number,
    title: issue.title,
    risk,
    approved: Boolean(approved),
    holder:
      holder.state === "live" || holder.state === "idle" ? holder.agent : null,
    claim: holder.state,
    idleMinutes: idleMinutes(holder),
    pr: pr
      ? { number: pr.number, state: String(pr.state).toLowerCase() }
      : null,
    checks: pr ? checks : null,
    group,
  }
}

const clip = (text) => {
  const s = String(text ?? "")
    .replace(/\s+/g, " ")
    .trim()
  return s.length <= 42 ? s : `${s.slice(0, 41)}…`
}

function table(rows) {
  const head = ["#", "Risk", "Holder", "Idle", "PR", "Checks", "Title"]
  const body = rows.map((row) => [
    String(row.number),
    row.risk ?? "none",
    row.holder ?? "none",
    row.idleMinutes == null
      ? row.claim === "live" || row.claim === "idle"
        ? "?"
        : "-"
      : String(row.idleMinutes),
    row.pr ? `#${row.pr.number} ${row.pr.state}` : "none",
    row.checks ?? "-",
    clip(row.title),
  ])
  const width = head.map((cell, i) =>
    Math.max(cell.length, ...body.map((line) => line[i].length))
  )
  const line = (cells) =>
    cells
      .map((cell, i) => cell.padEnd(width[i]))
      .join("  ")
      .trimEnd()
  return [line(head), ...body.map(line)].join("\n")
}

export function renderBoard(groups) {
  const out = []
  for (const [key, title] of GROUPS) {
    const list = groups[key] ?? []
    out.push(`${title} (${list.length})`)
    out.push(list.length ? table(list) : "None.")
    out.push("")
  }
  return out.join("\n").trimEnd()
}

function boardNext(groups) {
  if (groups.free[0])
    return `scripts/ocv-tools.mjs take ${groups.free[0].number}`
  if (groups.waiting[0])
    return `Ask a project admin to say approved, then run: scripts/ocv-tools.mjs approve ${groups.waiting[0].number}`
  if (groups.idle[0])
    return `scripts/ocv-tools.mjs take ${groups.idle[0].number}`
  if (groups.inReview[0]?.pr)
    return `scripts/review-pr.sh ${groups.inReview[0].pr.number}`
  if (groups.taken[0])
    return `scripts/ocv-tools.mjs status ${groups.taken[0].number}`
  return "scripts/ocv-tools.mjs help"
}

export function board(ctx, { json = false } = {}) {
  const snap = ctx.ports.gh.openBoard()
  const rows = []
  for (const issue of snap.issues) {
    if (String(issue.state).toUpperCase() !== "OPEN") continue
    const pr = prFor(snap.pulls, issue.number)
    rows.push(
      rowFrom(
        issue,
        snap.approvers,
        snap.serverNow,
        pr,
        checksFor(ctx.ports.gh, pr)
      )
    )
  }
  rows.sort((a, b) => a.number - b.number)
  const groups = {
    waiting: [],
    free: [],
    taken: [],
    idle: [],
    inReview: [],
  }
  for (const row of rows) groups[row.group].push(row)
  return {
    lines: [json ? JSON.stringify(groups, null, 2) : renderBoard(groups)],
    next: boardNext(groups),
  }
}
