// take and release: the claim on an issue, and the shared helpers save and cleanup use.
import { randomBytes } from "node:crypto"
import { join } from "node:path"
import { Refused, gh } from "./core.mjs"
import { TYPES } from "./fields.mjs"
import {
  CLAIM_IDLE_MINUTES,
  claimMarker,
  holderOf,
  releaseMarker,
} from "./claim-marker.mjs"
import { loadIssue, worktreeFor } from "./report.mjs"

export const nowOf = (ctx) => ctx.now?.() ?? Date.now()
export const git = (ctx, ...args) => ctx.run("git", args, { cwd: ctx.cwd })

const envAgent = (ctx) => (ctx.env ?? process.env).OCV_TASK_AGENT || null
const newAgent = () => `agent-${randomBytes(4).toString("hex")}`

// The agent id of this worktree: OCV_TASK_AGENT, else the id file in the worktree's git dir.
export function agentIdFor(ctx, gitDir) {
  const env = envAgent(ctx)
  if (env) return env
  try {
    return ctx.readFile(join(gitDir, "ocv-task-agent")).trim() || null
  } catch {
    return null
  }
}

// Where we are: the issue number and branch of the task worktree the command runs in.
export function taskHere(ctx) {
  const top = git(ctx, "rev-parse", "--show-toplevel")
  const branch = git(ctx, "rev-parse", "--abbrev-ref", "HEAD").out
  const m = new RegExp(`^(?:${TYPES.join("|")})/(\\d+)-`).exec(branch)
  if (!top.ok || !m)
    throw new Refused(
      "NOT_A_TASK",
      "this folder is not a task worktree (branch type/<n>-description)"
    )
  return {
    n: Number(m[1]),
    branch,
    top: top.out,
    gitDir: git(ctx, "rev-parse", "--absolute-git-dir").out,
  }
}

export const claimBody = ({ agent, at, branch }) =>
  `${claimMarker({ agent, at, branch })}\nocv-task: ${agent} holds this issue on branch ${branch}. Last saved ${at}. The claim can be taken over after ${CLAIM_IDLE_MINUTES} idle minutes.`

// Move the single claim comment's timestamp forward.
export function heartbeat(ctx, n, h, agent) {
  const body = claimBody({
    agent,
    at: new Date(nowOf(ctx)).toISOString(),
    branch: h.branch,
  })
  if (h.id)
    gh(
      ctx,
      "api",
      "-X",
      "PATCH",
      `repos/{owner}/{repo}/issues/comments/${h.id}`,
      "-f",
      `body=${body}`
    )
  else gh(ctx, "issue", "comment", String(n), "--body", body)
}

const bodyType = (body) =>
  TYPES.find((t) => new RegExp(`^### Type\\s+${t}\\s*$`, "m").test(body ?? ""))

export function take(ctx, n) {
  const { issue, risk, type, approved } = loadIssue(ctx, n)
  if (issue.state === "CLOSED") throw new Refused("CLOSED", `#${n} is closed`)
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
  const existing = worktreeFor(ctx, n)
  if (existing.worktree)
    throw new Refused(
      "WORKTREE_EXISTS",
      `#${n} already has a worktree: ${existing.worktree} (${existing.branch})`
    )
  const kind = type ?? bodyType(issue.body)
  if (!kind)
    throw new Refused(
      "MISSING_FIELDS",
      `#${n} has no Type (${TYPES.join(", ")})`
    )

  const root = git(ctx, "rev-parse", "--show-toplevel").out
  const desc = issue.title
    .replace(/^[a-z]+(\([^)]*\))?!?:\s*/i, "")
    .toLowerCase()
  const made = ctx.run(
    join(root, "scripts/new-task.sh"),
    [kind, String(n), "-d", desc],
    { cwd: root }
  )
  if (!made.ok)
    throw new Error(`new-task.sh failed: ${made.err || made.out}`.slice(0, 800))

  const { worktree, branch } = worktreeFor(ctx, n)
  if (!worktree)
    throw new Error(`new-task.sh ran but no worktree for #${n} was found`)
  const gitDir = ctx.run("git", [
    "-C",
    worktree,
    "rev-parse",
    "--absolute-git-dir",
  ]).out
  if (!envAgent(ctx)) ctx.writeFile(join(gitDir, "ocv-task-agent"), `${me}\n`)
  let port = "unknown"
  try {
    port = ctx.readFile(join(gitDir, "assigned-port")).trim()
  } catch {}
  const at = new Date(nowOf(ctx)).toISOString()
  try {
    gh(
      ctx,
      "issue",
      "comment",
      String(n),
      "--body",
      claimBody({ agent: me, at, branch })
    )
  } catch (e) {
    throw new Error(
      `worktree ${worktree} is ready but the claim could not be recorded: ${e.message}`
    )
  }
  return {
    lines: [
      `Took #${n} ${issue.title}${held.state === "idle" ? ` (took over idle claim of ${held.agent})` : ""}`,
      `Worktree: ${worktree}`,
      `Branch: ${branch}`,
      `Port: ${port}`,
      `Agent: ${me}`,
    ],
    next: `cd ${worktree}, do the work, run scripts/ocv-task.mjs save -m "<what you did>" at least every ${CLAIM_IDLE_MINUTES} minutes`,
  }
}

export function release(ctx, { n: given, reason }) {
  if (!reason) throw new Error("usage: ocv-task release --reason <why> [<n>]")
  const here = given ? null : taskHere(ctx)
  const n = given ?? here.n
  const gitDir = here?.gitDir ?? git(ctx, "rev-parse", "--absolute-git-dir").out
  const me = agentIdFor(ctx, gitDir)
  const { issue } = loadIssue(ctx, n)
  const h = holderOf(issue.comments.nodes, nowOf(ctx))
  if (!me || h.state === "none" || h.state === "released" || h.agent !== me)
    throw new Refused(
      "NOT_OWNER",
      `you (${me ?? "no agent id"}) do not hold #${n}${h.agent ? `; ${h.agent} does` : ""}`
    )
  const at = new Date(nowOf(ctx)).toISOString()
  gh(
    ctx,
    "issue",
    "comment",
    String(n),
    "--body",
    `${releaseMarker({ agent: me, at, reason })}\nocv-task: ${me} gave this issue back. Reason: ${reason}`
  )
  return {
    lines: [`Released #${n}: ${reason}`],
    next: `Another agent can run: scripts/ocv-task.mjs take ${n}`,
  }
}
