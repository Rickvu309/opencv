import { agentIdFor, envAgent } from "./claim.mjs"
import { lazyFacts } from "./lazy.mjs"
import { decide, refusalError } from "./rules/index.mjs"

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
  const open = String(issue.state).toUpperCase() === "OPEN"
  const verdict = decide(
    "approve",
    lazyFacts(
      {
        issue: { ...issue, state: open ? "OPEN" : "CLOSED" },
        claim: { state: "none" },
        me: null,
      },
      {
        account: () => ({
          login: String(ctx.ports.gh.login() ?? "").trim(),
          approvers: issue.approvers,
        }),
      }
    )
  )
  if (!verdict.ok) throw refusalError(verdict.refusals[0])
  if (issue.approved)
    return {
      lines: [
        `#${n} already has a valid /approve after the last edit. Nothing posted.`,
        WARN,
      ],
      next: `scripts/ocv-tools.mjs take ${n}`,
    }
  ctx.ports.gh.comment(n, approveComment(relayAgent(ctx)))
  return {
    lines: [`Posted /approve on #${n}.`, WARN],
    next: `scripts/ocv-tools.mjs take ${n}`,
  }
}
