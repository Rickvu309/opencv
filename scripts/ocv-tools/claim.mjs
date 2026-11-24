import { randomBytes } from "node:crypto"
import { join, resolve, sep } from "node:path"
import { claimMarker } from "./claim-marker.mjs"
import { TYPES } from "./fields.mjs"
import { decide, refusalError } from "./rules/index.mjs"
import { locate } from "./worktree.mjs"

export const nowOf = (ctx) => ctx.now?.() ?? Date.now()

export const envOf = (ctx) => ctx.env ?? process.env
export const envAgent = (ctx) => envOf(ctx).OCV_TOOLS_AGENT || null
export const newAgent = () => `agent-${randomBytes(4).toString("hex")}`

export function agentIdFor(ctx, gitDir) {
  const env = envAgent(ctx)
  if (env) return env
  try {
    return ctx.readFile(join(gitDir, "ocv-tools-agent")).trim() || null
  } catch {
    return null
  }
}

function hereFact(ctx) {
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

export const taskNow = (ctx) => hereFact(ctx)

export function taskHere(ctx, job = "save") {
  const here = hereFact(ctx)
  if (!here.ok) {
    const verdict = decide(job, { here })
    throw refusalError(verdict.refusals[0])
  }
  return here
}

export function readClaim(ctx, n, fresh = false) {
  const bag = ctx.facts.load(Number(n), ["issue", "claim"], { fresh })
  return {
    issue: bag.issue,
    labels: bag.issue.labels,
    risk: bag.issue.risk,
    type: bag.issue.type,
    holder: bag.claim,
    serverNow: bag.serverNow,
  }
}

export const claimBody = ({ agent, at, branch }) =>
  `${claimMarker({ agent, at, branch })}\nocv-tools: ${agent} works on this issue on branch ${branch} since ${at}.`
