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
import { loadIssue } from "./report.mjs"

export const nowOf = (ctx) => ctx.now?.() ?? Date.now()
export const git = (ctx, ...args) => ctx.run("git", args, { cwd: ctx.cwd })

export const envOf = (ctx) => ctx.env ?? process.env
export const envAgent = (ctx) => envOf(ctx).OCV_TOOLS_AGENT || null
export const newAgent = () => `agent-${randomBytes(4).toString("hex")}`

// The agent id of this worktree: OCV_TOOLS_AGENT, else the id file in the worktree's git dir.
export function agentIdFor(ctx, gitDir) {
  const env = envAgent(ctx)
  if (env) return env
  try {
    return ctx.readFile(join(gitDir, "ocv-tools-agent")).trim() || null
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
  `${claimMarker({ agent, at, branch })}\nocv-tools: ${agent} holds this issue on branch ${branch}. Last saved ${at}. The claim can be taken over after ${CLAIM_IDLE_MINUTES} idle minutes.`

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

export function release(ctx, { n: given, reason }) {
  if (!reason) throw new Error("usage: ocv-tools release --reason <why> [<n>]")
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
    `${releaseMarker({ agent: me, at, reason })}\nocv-tools: ${me} gave this issue back. Reason: ${reason}`
  )
  return {
    lines: [`Released #${n}: ${reason}`],
    next: `Another agent can run: scripts/ocv-tools.mjs take ${n}`,
  }
}
