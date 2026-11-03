import { fileURLToPath } from "node:url"
import { join } from "node:path"
import { worktreeFor } from "./report.mjs"

export const RULES_FILE = fileURLToPath(
  new URL("../../docs/agents/brief-rules.md", import.meta.url)
)
export const FENCES_FILE = fileURLToPath(
  new URL("../../docs/agents/brief-fences.json", import.meta.url)
)

const sectionOf = (markdown, heading) => {
  const lines = String(markdown).split("\n")
  const start = lines.findIndex((line) => line.trim() === `## ${heading}`)
  if (start < 0) throw new Error(`brief-rules.md has no "## ${heading}"`)
  const rest = lines.slice(start + 1)
  const end = rest.findIndex((line) => line.startsWith("## "))
  return (end < 0 ? rest : rest.slice(0, end)).join("\n")
}

export function parseRules(markdown) {
  const fenced = /```text\n([\s\S]*?)\n```/.exec(sectionOf(markdown, "Rules"))
  if (!fenced) throw new Error("brief-rules.md has no rules block")
  const rules = fenced[1].split("\n").filter((line) => /^\d+\. /.test(line))
  if (!rules.length) throw new Error("brief-rules.md has no numbered rule")
  return rules
}

export function parseRoles(markdown) {
  const roles = {}
  for (const line of sectionOf(markdown, "Roles").split("\n")) {
    const cells = line
      .split("|")
      .slice(1, -1)
      .map((cell) => cell.trim())
    if (cells.length < 3 || /^(Role|-+)$/.test(cells[0])) continue
    roles[cells[0]] = { model: cells[1], budget: Number(cells[2]) }
  }
  if (!Object.keys(roles).length)
    throw new Error("brief-rules.md has no role table")
  return roles
}

export function parseFences(text) {
  const list = JSON.parse(text || "{}").fences ?? []
  return list.flatMap((fence) =>
    (fence.paths ?? []).map((path) => ({ path, issue: fence.issue ?? null }))
  )
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
  const roles = parseRoles(ctx.ports.fs.read(RULES_FILE))
  if (!roles[role])
    throw new Error(
      `usage: ocv-tools brief <issue> --role ${Object.keys(roles).join("|")}`
    )
  const rules = parseRules(ctx.ports.fs.read(RULES_FILE))
  const fences = parseFences(ctx.ports.fs.read(FENCES_FILE))
  const { issue } = ctx.facts.load(n, ["issue"])
  const { worktree, branch } = worktreeFor(ctx, n)
  const port = portOf(ctx, worktree)
  const lines = [
    `Task: #${n} ${issue.title}`,
    `Role: ${role}`,
    `Model: ${roles[role].model}`,
    `Tool budget: ${roles[role].budget} calls`,
    worktree
      ? `Worktree: ${worktree} (branch ${branch})`
      : `Worktree: none yet; run scripts/ocv-tools.mjs take ${n}`,
    port
      ? `Port: ${port} (api on ${port}, web on ${port + 1000})`
      : "Port: none yet",
    fences.length ? "Fenced paths (never edit):" : "Fenced paths: none",
    ...fences.map(
      (fence) =>
        `  ${fence.path}${fence.issue ? ` (issue #${fence.issue})` : ""}`
    ),
    "",
    "Rules:",
    ...rules,
  ]
  return {
    lines,
    next: `Paste this into the agent's brief. Edit the rules in docs/agents/brief-rules.md.`,
  }
}
