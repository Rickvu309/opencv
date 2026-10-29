// `approve`: relay the owner's "approved" from chat onto a risk:high issue.
import { agentIdFor, envAgent } from "./claim.mjs"
import { Refused } from "./result.mjs"

const WARN =
  'The agent must only run this after the owner said "approved" in this chat.'

export function approveComment(agent) {
  const id = String(agent ?? "").replace(/\s+/g, "") || "unknown"
  return `/approve\nRelayed by agent ${id} from the owner in chat.`
}

function relayAgent(ctx) {
  const fromEnv = envAgent(ctx)
  if (fromEnv) return fromEnv
  const here = ctx.ports.git.here(ctx.cwd)
  if (!here.gitDirOk) return "unknown"
  return agentIdFor(ctx, here.gitDir) || "unknown"
}

export function approve(ctx, n) {
  const { issue } = ctx.facts.load(n, ["issue"])
  if (String(issue.state).toUpperCase() !== "OPEN")
    throw new Refused("CLOSED", `#${n} is closed`)
  if (issue.risk !== "high")
    throw new Refused(
      "NOT_HIGH_RISK",
      `#${n} is ${issue.risk ?? "unset"} risk, so no approval is needed`,
      `No approval is needed. Run: scripts/ocv-tools.mjs take ${n}`
    )
  if (issue.approved)
    return {
      lines: [
        `#${n} already has a valid /approve after the last edit. Nothing posted.`,
        WARN,
      ],
      next: `scripts/ocv-tools.mjs take ${n}`,
    }
  const me = String(ctx.ports.gh.login() ?? "").trim()
  const owner = String(ctx.ports.gh.repo().owner ?? "").trim()
  if (me.toLowerCase() !== owner.toLowerCase())
    throw new Refused(
      "NOT_OWNER",
      `signed in as ${me || "nobody"}, but only ${owner} can approve #${n}`,
      "run this as the owner account; take only accepts the owner's /approve"
    )
  ctx.ports.gh.comment(n, approveComment(relayAgent(ctx)))
  return {
    lines: [`Posted /approve on #${n}.`, WARN],
    next: `scripts/ocv-tools.mjs take ${n}`,
  }
}
