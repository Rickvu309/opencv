// `approve`: relay the owner's "approved" from chat onto a risk:high issue.
import { Refused, gh } from "./core.mjs"
import { agentIdFor, envAgent, git } from "./claim.mjs"
import { loadIssue } from "./report.mjs"

const WARN =
  'The agent must only run this after the owner said "approved" in this chat.'

export function approveComment(agent) {
  const id = String(agent ?? "").replace(/\s+/g, "") || "unknown"
  return `/approve\nRelayed by agent ${id} from the owner in chat.`
}

function relayAgent(ctx) {
  const fromEnv = envAgent(ctx)
  if (fromEnv) return fromEnv
  const gitDir = git(ctx, "rev-parse", "--absolute-git-dir")
  if (!gitDir.ok) return "unknown"
  return agentIdFor(ctx, gitDir.out) || "unknown"
}

export function approve(ctx, n) {
  const { issue, risk, approved } = loadIssue(ctx, n)
  if (String(issue.state).toUpperCase() !== "OPEN")
    throw new Refused("CLOSED", `#${n} is closed`)
  if (risk !== "high")
    throw new Refused(
      "NOT_HIGH_RISK",
      `#${n} is ${risk ?? "unset"} risk, so no approval is needed`,
      `No approval is needed. Run: scripts/ocv-tools.mjs take ${n}`
    )
  if (approved)
    return {
      lines: [
        `#${n} already has a valid /approve after the last edit. Nothing posted.`,
        WARN,
      ],
      next: `scripts/ocv-tools.mjs take ${n}`,
    }
  const me = gh(ctx, "api", "user", "--jq", ".login").trim()
  const owner = String(
    JSON.parse(gh(ctx, "repo", "view", "--json", "owner")).owner?.login ?? ""
  ).trim()
  if (me.toLowerCase() !== owner.toLowerCase())
    throw new Refused(
      "NOT_OWNER",
      `signed in as ${me || "nobody"}, but only ${owner} can approve #${n}`,
      "run this as the owner account; take only accepts the owner's /approve"
    )
  const body = approveComment(relayAgent(ctx))
  gh(ctx, "issue", "comment", String(n), "--body", body)
  return {
    lines: [`Posted /approve on #${n}.`, WARN],
    next: `scripts/ocv-tools.mjs take ${n}`,
  }
}
