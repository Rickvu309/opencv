// `board`: every open issue, grouped, with risk, claim, idle minutes, pull request and checks.
import { Refused, gh } from "./core.mjs"
import { TYPES } from "./fields.mjs"
import { holderOf } from "./claim-marker.mjs"
import { loadIssue } from "./report.mjs"

const LIST_QUERY = `query($owner:String!,$name:String!,$cursor:String){repository(owner:$owner,name:$name){issues(states:OPEN,first:50,after:$cursor){pageInfo{hasNextPage endCursor} nodes{number}}}}`
const LIST_CAP = 40
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

// risk:high without a valid /approve waits, even when someone holds it.
// An open pull request is in review only after that approval exists.
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

function listNumbers(ctx, repo) {
  const numbers = []
  const seen = new Set()
  let cursor = null
  for (let page = 0; page < LIST_CAP; page++) {
    const args = [
      "api",
      "graphql",
      "-f",
      `query=${LIST_QUERY}`,
      "-f",
      `owner=${repo.owner.login}`,
      "-f",
      `name=${repo.name}`,
    ]
    if (cursor) args.push("-f", `cursor=${cursor}`)
    const q = ctx.run("gh", args)
    if (!q.ok)
      throw new Error(`gh api graphql failed: ${q.err || q.out}`.slice(0, 400))
    const conn = JSON.parse(q.out).data.repository.issues
    for (const node of conn.nodes ?? []) {
      if (seen.has(node.number)) continue
      seen.add(node.number)
      numbers.push(node.number)
    }
    const info = conn.pageInfo ?? {}
    if (!info.hasNextPage) return numbers
    if (!info.endCursor || info.endCursor === cursor)
      throw new Refused(
        "UNKNOWN",
        "the open issue list stopped before the last page (the page cursor did not move)"
      )
    if (page === LIST_CAP - 1)
      throw new Refused(
        "UNKNOWN",
        `the open issue list is incomplete: ${LIST_CAP} pages were read and more issues remain`
      )
    cursor = info.endCursor
  }
  return numbers
}

function idleMinutes(holder) {
  if (holder.state !== "live" && holder.state !== "idle") return null
  return Number.isFinite(holder.idleMinutes) ? holder.idleMinutes : null
}

function rowFrom(loaded, pr) {
  const holder = holderOf(loaded.issue.comments.nodes, loaded.serverNow)
  const open = Boolean(pr) && String(pr.state).toUpperCase() === "OPEN"
  const group = groupOf({
    risk: loaded.risk,
    approved: loaded.approved,
    claim: holder.state,
    prOpen: open,
  })
  return {
    number: loaded.issue.number,
    title: loaded.issue.title,
    risk: loaded.risk,
    approved: Boolean(loaded.approved),
    holder:
      holder.state === "live" || holder.state === "idle" ? holder.agent : null,
    claim: holder.state,
    idleMinutes: idleMinutes(holder),
    pr: pr
      ? { number: pr.number, state: String(pr.state).toLowerCase() }
      : null,
    checks: pr ? checkState(pr.statusCheckRollup) : null,
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
    return `Ask the owner to say approved, then run: scripts/ocv-tools.mjs approve ${groups.waiting[0].number}`
  if (groups.idle[0])
    return `scripts/ocv-tools.mjs take ${groups.idle[0].number}`
  if (groups.inReview[0]?.pr)
    return `scripts/review-pr.sh ${groups.inReview[0].pr.number}`
  if (groups.taken[0])
    return `scripts/ocv-tools.mjs status ${groups.taken[0].number}`
  return "scripts/ocv-tools.mjs help"
}

export function board(ctx, { json = false } = {}) {
  const repo = JSON.parse(gh(ctx, "repo", "view", "--json", "owner,name"))
  const numbers = listNumbers(ctx, repo)
  const prs = JSON.parse(
    gh(
      ctx,
      "pr",
      "list",
      "--state",
      "all",
      "--limit",
      "200",
      "--json",
      "number,state,headRefName,statusCheckRollup"
    )
  )
  const rows = []
  for (const n of numbers) {
    const loaded = loadIssue(ctx, n)
    if (String(loaded.issue.state).toUpperCase() !== "OPEN") continue
    rows.push(rowFrom(loaded, prFor(prs, loaded.issue.number)))
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
