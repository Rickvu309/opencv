import { fileURLToPath } from "node:url"
import { join } from "node:path"
import { nowOf } from "./claim.mjs"
import { worktreeFor } from "./report.mjs"

export const READ_ONLY_ROLES = ["review", "plan"]

export const RULES_FILE = fileURLToPath(
  new URL("../../AGENTS.md", import.meta.url)
)
export const FENCES_FILE = fileURLToPath(
  new URL("../../docs/agents/brief-fences.json", import.meta.url)
)

const ROLES = {
  build: { model: "opus", budget: 60 },
  mechanical: { model: "haiku", budget: 40 },
  review: { model: "opus", budget: 40 },
  plan: { model: "opus", budget: 40 },
}

const fenceEnd = (date) => Date.parse(`${date}T23:59:59Z`)

export function parseFences(text, now) {
  const list = JSON.parse(text || "{}").fences ?? []
  const active = []
  const expired = []
  for (const fence of list) {
    const end = fenceEnd(fence.expires)
    if (Number.isNaN(end))
      throw new Error(
        `brief-fences.json: the fence for #${fence.issue} needs "expires" as YYYY-MM-DD`
      )
    if (now > end) expired.push({ issue: fence.issue, expires: fence.expires })
    else
      active.push(
        ...(fence.paths ?? []).map((path) => ({ path, issue: fence.issue }))
      )
  }
  return { active, expired }
}

function portOf(ctx, worktree) {
  if (!worktree) return null
  try {
    const m = /^PORT=(\d+)$/m.exec(ctx.ports.fs.read(join(worktree, ".env")))
    return m ? Number(m[1]) : null
  } catch {
    return null
  }
}

export function brief(ctx, n, { role }) {
  if (!ROLES[role])
    throw new Error(
      `usage: ocv-tools brief <issue> --role ${Object.keys(ROLES).join("|")}`
    )
  const rules = ctx.ports.fs.read(RULES_FILE)
  const { active: fences, expired } = parseFences(
    ctx.ports.fs.read(FENCES_FILE),
    nowOf(ctx)
  )
  const readOnly = READ_ONLY_ROLES.includes(role)
  const { issue } = ctx.facts.load(n, ["issue"])
  const { worktree, branch } = worktreeFor(ctx, n)
  const port = portOf(ctx, worktree)
  const lines = [
    `Task: #${n} ${issue.title}`,
    `Role: ${role}`,
    ...(readOnly ? ["Mode: read only"] : []),
    `Model: ${ROLES[role].model}`,
    `Tool budget: ${ROLES[role].budget} calls`,
    worktree
      ? `Worktree: ${worktree} (branch ${branch})`
      : readOnly
        ? "Worktree: none (read only)"
        : `Worktree: none yet; run scripts/ocv-tools.mjs take ${n}`,
    port
      ? `Port: ${port} (api on ${port}, web on ${port + 1000})`
      : "Port: none yet",
    fences.length ? "Fenced paths (never edit):" : "Fenced paths: none",
    ...fences.map(
      (fence) =>
        `  ${fence.path}${fence.issue ? ` (issue #${fence.issue})` : ""}`
    ),
    ...expired.map(
      (fence) =>
        `Fence for #${fence.issue} expired on ${fence.expires} and is not listed`
    ),
    "",
    "Rules:",
    rules,
  ]
  return {
    lines,
    next: `Paste this into the agent's brief. Edit the rules in AGENTS.md.`,
  }
}
