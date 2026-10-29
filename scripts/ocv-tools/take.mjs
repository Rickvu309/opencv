// take: do the whole start-of-work job in Node (it replaces scripts/new-task.sh). Checks the
// issue, makes the branch and worktree, assigns the issue, records the claim comment and writes
// the workflow result file (script "new-task").
import { join } from "node:path"
import { Refused, gh } from "./core.mjs"
import { TYPES } from "./fields.mjs"
import { CLAIM_IDLE_MINUTES, holderOf } from "./claim-marker.mjs"
import { claimBody, envAgent, envOf, newAgent, nowOf } from "./claim.mjs"
import { file } from "./issue.mjs"
import { loadIssue, worktreeFor } from "./report.mjs"
import { writeResult } from "./result.mjs"
import { basename } from "node:path"
import { createWorktree, descFromTitle, locate } from "./worktree.mjs"

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
    return { ...r, tail: done("ok", { detail: r.lines[0], next: r.next }) }
  } catch (error) {
    error.tail = done("fail", {
      cause: error.cause ?? "hygiene",
      detail: error.message,
    })
    throw error
  }
}

function takeInner(ctx, target, flags, setId) {
  let n = Number(String(target).replace(/^#/, ""))
  if (!Number.isInteger(n) || n < 1) {
    const filed = fileFirst(ctx, String(target), flags)
    if (filed.done) {
      return { ...filed.done, noResult: true }
    }
    n = filed.n
  }
  const { issue, labels, risk, type, approved } = loadIssue(ctx, n)
  const kind = flags["--type"] ?? type ?? bodyType(issue.body)
  setId(`${kind ?? "task"}-${n}`)
  if (issue.state === "CLOSED") throw new Refused("CLOSED", `#${n} is closed`)
  if (labels.includes("ready-for-human"))
    throw new Refused(
      "READY_FOR_HUMAN",
      `#${n} is labeled ready-for-human: it is a decision for a human, never an agent task`
    )
  const me = envAgent(ctx) ?? newAgent()
  const held = holderOf(issue.comments.nodes, nowOf(ctx))
  if (held.state === "live" && held.agent !== me)
    throw new Refused(
      "HELD",
      `#${n} is held by ${held.agent} (last saved ${held.idleMinutes} min ago; free after ${CLAIM_IDLE_MINUTES})`
    )
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

  const made = createWorktree(ctx, {
    type: kind,
    issue: n,
    desc: flags["-d"] ?? descFromTitle(issue.title),
    install: !flags["--no-install"],
  })
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
  const at = new Date(nowOf(ctx)).toISOString()
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
