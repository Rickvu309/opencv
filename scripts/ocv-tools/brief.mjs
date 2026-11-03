import { fileURLToPath } from "node:url"
import { join } from "node:path"
import { nowOf } from "./claim.mjs"
import { worktreeFor } from "./report.mjs"

export const READ_ONLY_ROLES = ["review", "plan"]

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

const RULE = /^(\d+)\. \[([a-z ]+)\] (.+?) \(AGENTS\.md: ([^)]+)\)$/

export function parseRuleLine(line) {
  const m = RULE.exec(line)
  if (!m) return null
  const roles = m[2].trim().split(/\s+/)
  return { number: Number(m[1]), roles, text: m[3], section: m[4], line }
}

export function parseRules(markdown) {
  const fenced = /```text\n([\s\S]*?)\n```/.exec(sectionOf(markdown, "Rules"))
  if (!fenced) throw new Error("brief-rules.md has no rules block")
  const lines = fenced[1].split("\n").filter((line) => /^\d+\. /.test(line))
  if (!lines.length) throw new Error("brief-rules.md has no numbered rule")
  return lines.map((line) => {
    const rule = parseRuleLine(line)
    if (!rule)
      throw new Error(
        `brief-rules.md rule needs "[roles]" first and "(AGENTS.md: Section)" last: ${line}`
      )
    return rule
  })
}

export const rulesForRole = (rules, role) =>
  rules.filter(
    (rule) => rule.roles.includes("all") || rule.roles.includes(role)
  )

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
  const roles = parseRoles(ctx.ports.fs.read(RULES_FILE))
  if (!roles[role])
    throw new Error(
      `usage: ocv-tools brief <issue> --role ${Object.keys(roles).join("|")}`
    )
  const rules = rulesForRole(parseRules(ctx.ports.fs.read(RULES_FILE)), role)
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
    `Model: ${roles[role].model}`,
    `Tool budget: ${roles[role].budget} calls`,
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
    ...rules.map((rule, index) => `${index + 1}. ${rule.text}`),
  ]
  return {
    lines,
    next: `Paste this into the agent's brief. Edit the rules in docs/agents/brief-rules.md.`,
  }
}
