// `board`: every open issue, grouped, with risk, claim, idle minutes, pull request and checks.
// One repo lookup, one server clock and one paged issue query per run. Comment
// pages are fetched only when the first page says more exist.
import { Refused, gh } from "./core.mjs"
import { TYPES } from "./fields.mjs"
import { readServerNow } from "./clock.mjs"
import { holderOf } from "./claim-marker.mjs"
import { COMMENT_PAGE_CAP, approvalValid, riskOf } from "./report.mjs"

const ISSUE_QUERY = `query($owner:String!,$name:String!,$cursor:String){repository(owner:$owner,name:$name){issues(states:OPEN,first:50,after:$cursor){pageInfo{hasNextPage endCursor} nodes{number title state body createdAt lastEditedAt labels(first:50){nodes{name}} comments(first:100){pageInfo{hasNextPage endCursor} nodes{databaseId author{login} body createdAt updatedAt}}}}}}`
const COMMENT_QUERY = `query($owner:String!,$name:String!,$n:Int!,$cursor:String){repository(owner:$owner,name:$name){issue(number:$n){comments(first:100,after:$cursor){pageInfo{hasNextPage endCursor} nodes{databaseId author{login} body createdAt updatedAt}}}}}`
const PR_QUERY = `query($owner:String!,$name:String!,$cursor:String){repository(owner:$owner,name:$name){pullRequests(states:OPEN,first:100,after:$cursor){pageInfo{hasNextPage endCursor} nodes{number state headRefName headRefOid}}}}`
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

function graphql(ctx, query, vars) {
  const args = ["api", "graphql", "-f", `query=${query}`]
  for (const [key, value] of Object.entries(vars)) {
    if (value == null || value === "") continue
    if (typeof value === "number") args.push("-F", `${key}=${value}`)
    else args.push("-f", `${key}=${value}`)
  }
  const q = ctx.run("gh", args)
  if (!q.ok)
    throw new Error(`gh api graphql failed: ${q.err || q.out}`.slice(0, 400))
  return JSON.parse(q.out)
}

function pageAll(ctx, repo, { query, pick, cap, stuck, incomplete }) {
  const items = []
  const seen = new Set()
  let cursor = null
  for (let page = 0; page < cap; page++) {
    const data = graphql(ctx, query, {
      owner: repo.owner.login,
      name: repo.name,
      cursor,
    })
    const conn = pick(data)
    if (!conn?.pageInfo || typeof conn.pageInfo.hasNextPage !== "boolean")
      throw new Refused("UNKNOWN", stuck)
    for (const node of conn.nodes ?? []) {
      if (seen.has(node.number)) continue
      seen.add(node.number)
      items.push(node)
    }
    const info = conn.pageInfo
    if (!info.hasNextPage) return items
    if (!info.endCursor || info.endCursor === cursor)
      throw new Refused("UNKNOWN", stuck)
    if (page === cap - 1) throw new Refused("UNKNOWN", incomplete)
    cursor = info.endCursor
  }
  return items
}

// First page is oldest-first. A later page can hold the live claim, so a
// hasNextPage result is never treated as the whole history.
function completeComments(ctx, repo, issue) {
  const conn = issue.comments ?? {}
  if (!conn.pageInfo || typeof conn.pageInfo.hasNextPage !== "boolean")
    throw new Refused(
      "UNKNOWN",
      `claim history for #${issue.number} did not say whether more comments exist`
    )
  const nodes = [...(conn.nodes ?? [])]
  let info = conn.pageInfo
  let cursor = info.endCursor ?? null
  let pages = 1
  while (info.hasNextPage) {
    if (!cursor || pages >= COMMENT_PAGE_CAP)
      throw new Refused(
        "UNKNOWN",
        pages >= COMMENT_PAGE_CAP
          ? `claim history for #${issue.number} is incomplete: ${COMMENT_PAGE_CAP} pages were read and more comments remain`
          : `claim history for #${issue.number} stopped before the last comment (the page cursor did not move)`
      )
    const data = graphql(ctx, COMMENT_QUERY, {
      owner: repo.owner.login,
      name: repo.name,
      n: issue.number,
      cursor,
    })
    const next = data.data?.repository?.issue?.comments ?? {}
    const pageInfo = next.pageInfo ?? {}
    if (
      typeof pageInfo.hasNextPage !== "boolean" ||
      (pageInfo.hasNextPage &&
        (!pageInfo.endCursor || pageInfo.endCursor === cursor))
    )
      throw new Refused(
        "UNKNOWN",
        `claim history for #${issue.number} stopped before the last comment (the page cursor did not move)`
      )
    nodes.push(...(next.nodes ?? []))
    info = pageInfo
    cursor = pageInfo.endCursor ?? null
    pages++
  }
  return nodes
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

// One call per open pull request we show: the latest check run named ci.
function ciChecks(ctx, sha) {
  if (!sha) return "none"
  const out = gh(
    ctx,
    "api",
    "--method",
    "GET",
    `repos/{owner}/{repo}/commits/${sha}/check-runs`,
    "-f",
    "check_name=ci",
    "-f",
    "filter=latest",
    "-f",
    "per_page=10"
  )
  const best = latestCi(JSON.parse(out).check_runs ?? [])
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

function rowFrom(issue, thread, owner, serverNow, pr, checks) {
  const labels = (issue.labels?.nodes ?? []).map((label) => label.name)
  const risk = riskOf(labels, issue.body ?? "")
  const approved = approvalValid({
    comments: thread,
    owner,
    lastEditedAt: issue.lastEditedAt,
    createdAt: issue.createdAt,
  })
  const holder = holderOf(thread, serverNow)
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
  const issues = pageAll(ctx, repo, {
    query: ISSUE_QUERY,
    pick: (data) => data.data?.repository?.issues,
    cap: LIST_CAP,
    stuck:
      "the open issue list stopped before the last page (the page cursor did not move)",
    incomplete: `the open issue list is incomplete: ${LIST_CAP} pages were read and more issues remain`,
  })
  const serverNow = readServerNow(ctx)
  const prs = pageAll(ctx, repo, {
    query: PR_QUERY,
    pick: (data) => data.data?.repository?.pullRequests,
    cap: LIST_CAP,
    stuck:
      "the open pull request list stopped before the last page (the page cursor did not move)",
    incomplete: `the open pull request list is incomplete: ${LIST_CAP} pages were read and more pull requests remain`,
  })
  const rows = []
  for (const issue of issues) {
    if (String(issue.state).toUpperCase() !== "OPEN") continue
    const thread = completeComments(ctx, repo, issue)
    const pr = prFor(prs, issue.number)
    const checks = pr ? ciChecks(ctx, pr.headRefOid) : null
    rows.push(rowFrom(issue, thread, repo.owner.login, serverNow, pr, checks))
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
