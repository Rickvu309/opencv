// take and release: the claim on an issue, and the shared helpers save and cleanup use.
import { randomBytes } from "node:crypto"
import { join, resolve, sep } from "node:path"
import {
  CLAIM_IDLE_MINUTES,
  claimMarker,
  releaseMarker,
} from "./claim-marker.mjs"
import { TYPES } from "./fields.mjs"
import { decide, refusalError } from "./rules/decide.mjs"
import { locate } from "./worktree.mjs"

export const nowOf = (ctx) => ctx.now?.() ?? Date.now()

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
// locate() failing stays NOT_A_TASK, the same as the old catch.
export function hereFact(ctx) {
  const here = ctx.ports.git.here(ctx.cwd)
  const branch = here.branch
  const m = new RegExp(`^(?:${TYPES.join("|")})/(\\d+)-`).exec(branch ?? "")
  let linked = false
  let under = false
  let place = null
  if (here.topOk && here.gitDirOk && here.commonOk) {
    linked = resolve(here.gitDir) !== resolve(here.common)
    try {
      place = locate(ctx)
      under = resolve(here.top).startsWith(resolve(place.root) + sep)
    } catch {
      under = false
    }
  }
  return {
    ok: Boolean(here.topOk && m && linked && under),
    n: m ? Number(m[1]) : null,
    branch,
    top: here.top,
    gitDir: here.gitDir,
    main: place?.main ?? null,
    root: place?.root ?? null,
  }
}

export function taskHere(ctx, job = "save") {
  const here = hereFact(ctx)
  if (!here.ok) {
    const verdict = decide(job, { here })
    throw refusalError(verdict.refusals[0])
  }
  return here
}

// One read of the issue plus the holder, timed on GitHub's clock.
// fresh re-reads. The loader otherwise returns the run's cached facts.
export function readClaim(ctx, n, fresh = false) {
  const bag = ctx.facts.load(Number(n), ["issue", "claim"], { fresh })
  return {
    issue: bag.issue,
    labels: bag.issue.labels,
    risk: bag.issue.risk,
    type: bag.issue.type,
    approved: bag.issue.approved,
    holder: bag.claim,
    serverNow: bag.serverNow,
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
  if (!h.id) return ctx.ports.gh.comment(n, body)
  const stamp = ctx.ports.gh.editComment(h.id, body)
  if (!stamp)
    throw new Error("claim refresh did not return updatedAt from GitHub")
  return stamp
}

export function release(ctx, { n: given, reason }) {
  if (!reason) throw new Error("usage: ocv-tools release --reason <why> [<n>]")
  const here = given ? { ok: true } : taskHere(ctx, "release")
  const n = given ?? here.n
  const gitDir = given ? ctx.ports.git.here(ctx.cwd).gitDir : here.gitDir
  const me = agentIdFor(ctx, gitDir)
  const read = readClaim(ctx, n, true)
  const h = read.holder
  const verdict = decide("release", {
    here,
    issue: read.issue,
    claim: h,
    me,
    history: { kind: "complete" },
    repo: { ok: true },
  })
  if (!verdict.ok) throw refusalError(verdict.refusals[0])
  const { serverNow } = read
  const at = new Date(serverNow).toISOString()
  ctx.ports.gh.comment(
    n,
    `${releaseMarker({ agent: me, at, reason })}\nocv-tools: ${me} gave this issue back. Reason: ${reason}`
  )
  return {
    lines: [`Released #${n}: ${reason}`],
    next: `Another agent can run: scripts/ocv-tools.mjs take ${n}`,
  }
}
