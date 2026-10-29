// take and release: the claim on an issue, and the shared helpers save and cleanup use.
import { randomBytes } from "node:crypto"
import { join, resolve, sep } from "node:path"
import { Refused, gh } from "./core.mjs"
import { TYPES } from "./fields.mjs"
import {
  CLAIM_IDLE_MINUTES,
  claimMarker,
  holderOf,
  releaseMarker,
} from "./claim-marker.mjs"
import { parseUpdatedAt } from "./clock.mjs"
import { loadIssue } from "./report.mjs"
import { locate } from "./worktree.mjs"

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

// Where we are: a linked worktree under the clone's ../<repo>.worktrees root,
// on a task branch. A normal clone, even on a task branch, is not a task.
export function taskHere(ctx) {
  const top = git(ctx, "rev-parse", "--show-toplevel")
  const branch = git(ctx, "rev-parse", "--abbrev-ref", "HEAD").out
  const gitDir = git(ctx, "rev-parse", "--absolute-git-dir")
  const common = git(
    ctx,
    "rev-parse",
    "--path-format=absolute",
    "--git-common-dir"
  )
  const m = new RegExp(`^(?:${TYPES.join("|")})/(\\d+)-`).exec(branch)
  let linked = false
  let under = false
  if (top.ok && gitDir.ok && common.ok) {
    linked = resolve(gitDir.out) !== resolve(common.out)
    try {
      const root = resolve(locate(ctx).root)
      under = resolve(top.out).startsWith(root + sep)
    } catch {
      under = false
    }
  }
  if (!top.ok || !m || !linked || !under)
    throw new Refused(
      "NOT_A_TASK",
      "this folder is not a linked task worktree under ../opencv.worktrees on branch type/<n>-description"
    )
  return { n: Number(m[1]), branch, top: top.out, gitDir: gitDir.out }
}

// One read of the issue plus the holder, timed on GitHub's clock.
export function readClaim(ctx, n) {
  const loaded = loadIssue(ctx, n)
  return {
    ...loaded,
    holder: holderOf(loaded.issue.comments.nodes, loaded.serverNow),
  }
}

export const claimBody = ({ agent, at, branch }) =>
  `${claimMarker({ agent, at, branch })}\nocv-tools: ${agent} holds this issue on branch ${branch}. Last saved ${at}. The claim can be taken over after ${CLAIM_IDLE_MINUTES} idle minutes.`

// Move the single claim comment forward. The lease is the comment's updatedAt
// in the PATCH response, not a time this process writes into the marker.
export function heartbeat(ctx, n, h, agent) {
  const body = claimBody({
    agent,
    at: h.updatedAt || h.createdAt || "server",
    branch: h.branch,
  })
  if (!h.id) return gh(ctx, "issue", "comment", String(n), "--body", body)
  const out = gh(
    ctx,
    "api",
    "--include",
    "-X",
    "PATCH",
    `repos/{owner}/{repo}/issues/comments/${h.id}`,
    "-f",
    `body=${body}`
  )
  const stamp = parseUpdatedAt(out)
  if (!stamp)
    throw new Error("claim refresh did not return updatedAt from GitHub")
  return stamp
}

export function release(ctx, { n: given, reason }) {
  if (!reason) throw new Error("usage: ocv-tools release --reason <why> [<n>]")
  const here = given ? null : taskHere(ctx)
  const n = given ?? here.n
  const gitDir = here?.gitDir ?? git(ctx, "rev-parse", "--absolute-git-dir").out
  const me = agentIdFor(ctx, gitDir)
  const { holder: h, serverNow } = readClaim(ctx, n)
  if (!me || h.state === "none" || h.state === "released" || h.agent !== me)
    throw new Refused(
      "NOT_OWNER",
      `you (${me ?? "no agent id"}) do not hold #${n}${h.agent ? `; ${h.agent} does` : ""}`
    )
  const at = new Date(serverNow).toISOString()
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
