import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"
import { parseArgs } from "node:util"

export const settings = {
  allow_squash_merge: true,
  allow_merge_commit: false,
  allow_rebase_merge: false,
  delete_branch_on_merge: true,
  has_projects: false,
}

const quote = (text) => `"${text.replace(/(["\\$`])/g, "\\$1")}"`

export function parseLabels(text) {
  const labels = []
  for (const line of text.split("\n")) {
    const entry = line.match(/^(- |  )(name|color|description): ?(.*)$/)
    if (!entry) continue
    const value = entry[3].replace(/^"(.*)"$/, "$1")
    if (entry[2] === "name") labels.push({ name: value })
    else labels.at(-1)[entry[2]] = value
  }
  return labels
}

export function labelDrift(declared, live) {
  const drift = []
  const liveByName = new Map(live.map((label) => [label.name, label]))
  for (const label of declared) {
    const found = liveByName.get(label.name)
    const args = `${quote(label.name)} --color ${label.color} --description ${quote(label.description ?? "")}`
    if (!found)
      drift.push({
        area: "label",
        subject: label.name,
        detail: "in .github/labels.yml, missing on GitHub",
        fix: `gh label create ${args}`,
      })
    else if (
      found.color.toLowerCase() !== label.color.toLowerCase() ||
      (found.description ?? "") !== (label.description ?? "")
    )
      drift.push({
        area: "label",
        subject: label.name,
        detail: `colour/description differ (GitHub: ${found.color} "${found.description ?? ""}")`,
        fix: `gh label edit ${args}`,
      })
  }
  const names = new Set(declared.map((label) => label.name))
  for (const label of live)
    if (!names.has(label.name))
      drift.push({
        area: "label",
        subject: label.name,
        detail:
          "on GitHub, not in .github/labels.yml (deleting strips it from issues)",
        fix: `gh label delete ${quote(label.name)} --yes`,
      })
  return drift
}

export function subsetDrift(declared, live, path = "") {
  if (Array.isArray(declared)) {
    if (!Array.isArray(live)) return [`${path}: expected a list`]
    if (!declared.every((item) => item && typeof item === "object")) {
      const sorted = (list) => JSON.stringify([...list].sort())
      return sorted(declared) === sorted(live)
        ? []
        : [
            `${path}: git ${JSON.stringify(declared)}, GitHub ${JSON.stringify(live)}`,
          ]
    }
    const key = (item) => item.type ?? item.actor_id ?? item.context
    const problems = []
    for (const item of declared) {
      const found = live.find((other) => key(other) === key(item))
      problems.push(
        ...(found
          ? subsetDrift(item, found, `${path}[${key(item)}]`)
          : [`${path}[${key(item)}]: in git, missing on GitHub`])
      )
    }
    for (const item of live)
      if (!declared.some((other) => key(other) === key(item)))
        problems.push(`${path}[${key(item)}]: on GitHub, not in git`)
    return problems
  }
  if (declared && typeof declared === "object") {
    if (!live || typeof live !== "object")
      return [`${path}: expected an object`]
    return Object.entries(declared).flatMap(([name, value]) =>
      subsetDrift(value, live[name], path ? `${path}.${name}` : name)
    )
  }
  return declared === live
    ? []
    : [
        `${path}: git ${JSON.stringify(declared)}, GitHub ${JSON.stringify(live)}`,
      ]
}

export function rulesetDrift(declared, live) {
  const file = ".github/rulesets/main.json"
  if (!live)
    return [
      {
        area: "ruleset",
        subject: declared.name,
        detail: `${file} has no live ruleset`,
        fix: `gh api -X POST repos/{owner}/{repo}/rulesets --input ${file}`,
      },
    ]
  return subsetDrift(declared, live).map((problem) => ({
    area: "ruleset",
    subject: declared.name,
    detail: problem,
    fix: `gh api -X PUT repos/{owner}/{repo}/rulesets/${live.id} --input ${file}`,
  }))
}

export function settingsDrift(live, alertsEnabled) {
  const drift = Object.entries(settings)
    .filter(([name, value]) => live[name] !== value)
    .map(([name, value]) => ({
      area: "setting",
      subject: name,
      detail: `GitHub has ${live[name]}, should be ${value}`,
      fix: `gh api -X PATCH repos/{owner}/{repo} -F ${name}=${value}`,
    }))
  if (!alertsEnabled)
    drift.push({
      area: "setting",
      subject: "vulnerability alerts",
      detail: "disabled, should be enabled",
      fix: "gh api -X PUT repos/{owner}/{repo}/vulnerability-alerts",
    })
  return drift
}

export async function doctor(io) {
  return [
    ...labelDrift(
      parseLabels(io.read(".github/labels.yml")),
      await io.labels()
    ),
    ...rulesetDrift(
      JSON.parse(io.read(".github/rulesets/main.json")),
      await io.ruleset("main")
    ),
    ...settingsDrift(await io.repo(), await io.alertsEnabled()),
  ]
}

export function format(drift) {
  if (!drift.length) return "doctor: no drift between git and GitHub"
  const lines = drift.flatMap((d) => [
    `DRIFT ${d.area} ${d.subject}: ${d.detail}`,
    `  fix: ${d.fix}`,
  ])
  lines.push(`doctor: ${drift.length} drift`)
  return lines.join("\n")
}

const gh = (args) =>
  execFileSync("gh", args, {
    encoding: "utf8",
    timeout: 30_000,
    stdio: ["ignore", "pipe", "pipe"],
  })
const api = (path) =>
  JSON.parse(gh(["api", "--paginate", `repos/{owner}/{repo}${path}`]))

export const liveIo = {
  read: (path) =>
    readFileSync(new URL(`../../${path}`, import.meta.url), "utf8"),
  labels: () =>
    JSON.parse(
      gh([
        "label",
        "list",
        "--limit",
        "200",
        "--json",
        "name,color,description",
      ])
    ),
  async ruleset(name) {
    const found = api("/rulesets").find((ruleset) => ruleset.name === name)
    return found ? api(`/rulesets/${found.id}`) : null
  },
  repo: () => api(""),
  alertsEnabled() {
    try {
      gh(["api", "repos/{owner}/{repo}/vulnerability-alerts"])
      return true
    } catch (error) {
      if (/HTTP 404/.test(String(error.stderr))) return false
      throw error
    }
  },
}

export async function runCli(args, io = liveIo) {
  const { values } = parseArgs({ args, options: { json: { type: "boolean" } } })
  const drift = await doctor(io)
  console.log(values.json ? JSON.stringify({ drift }, null, 2) : format(drift))
  return drift.length ? 1 : 0
}
