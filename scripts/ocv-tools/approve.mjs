// `approve`: relay an admin's "approved" from chat onto a risk:high issue.
import { agentIdFor, envAgent } from "./claim.mjs"
import { evaluate, refusalError } from "./rules/decide.mjs"

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

function refuse(id, facts) {
  const hit = evaluate(id, facts)
  if (!hit) throw new Error(`approve expected ${id} to refuse`)
  throw refusalError(hit)
}

export function approve(ctx, n) {
  const { issue } = ctx.facts.load(n, ["issue"])
  if (String(issue.state).toUpperCase() !== "OPEN")
    refuse("CLOSED", { issue: { ...issue, state: "CLOSED" } })
  const risk = evaluate("NOT_HIGH_RISK", { issue })
  if (risk) throw refusalError(risk)
  if (issue.approved)
    return {
      lines: [
        `#${n} already has a valid /approve after the last edit. Nothing posted.`,
        WARN,
      ],
      next: `scripts/ocv-tools.mjs take ${n}`,
    }
  const me = String(ctx.ports.gh.login() ?? "").trim()
  const approvers = issue.approvers
  const held = evaluate("NOT_OWNER", {
    issue,
    claim: { state: "none" },
    me: null,
    account: { login: me, approvers },
  })
  if (held) throw refusalError(held)
  ctx.ports.gh.comment(n, approveComment(relayAgent(ctx)))
  return {
    lines: [`Posted /approve on #${n}.`, WARN],
    next: `scripts/ocv-tools.mjs take ${n}`,
  }
}
