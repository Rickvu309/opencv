import { existsSync, readFileSync, readdirSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..")

export const PART_JOBS = Object.freeze({
  api: ["test-api"],
  formal: ["formal-postgres"],
  web: ["test-web"],
})

const PART_TASKS = Object.freeze({
  api: { app: "apps/api", task: "test" },
  formal: { app: "apps/api", task: "test:formal" },
  web: { app: "apps/web", task: "test" },
})

const EVERYTHING = [
  /^\.github\//,
  /^package\.json$/,
  /^pnpm-lock\.yaml$/,
  /^pnpm-workspace\.yaml$/,
  /^turbo\.json$/,
  /^tsconfig\.json$/,
  /^packwerk\.yml$/,
  /^(apps|packages)\/[^/]+\/(package\.json|turbo\.json)$/,
  /(^|\/)\.env/,
]

const NOTHING = [
  /^docs\//,
  /^scripts\//,
  /^\.agents\//,
  /^[^/]+\.md$/,
  /^\.gitattributes$/,
  /^\.gitignore$/,
  /^\.githooks\//,
  /^opencv\.json$/,
]

export function globPattern(glob) {
  const source = glob
    .split("**")
    .map((part) =>
      part
        .split("*")
        .map((piece) => piece.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
        .join("[^/]*")
    )
    .join(".*")
  return new RegExp(`^${source}$`)
}

export function changeMap(changedPaths, graph) {
  const parts = new Set()
  const unknown = []
  for (const file of changedPaths) {
    if (EVERYTHING.some((rule) => rule.test(file)))
      return {
        parts: Object.keys(PART_JOBS),
        reason: `${file} reaches every part`,
      }
    let reached = false
    for (const [part, patterns] of Object.entries(graph.parts))
      if (patterns.some((pattern) => pattern.test(file))) {
        parts.add(part)
        reached = true
      }
    if (!reached && !NOTHING.some((rule) => rule.test(file))) unknown.push(file)
  }
  if (unknown.length)
    return {
      parts: Object.keys(PART_JOBS),
      reason: `${unknown[0]} is not in the graph`,
    }
  return { parts: [...parts].sort(), reason: null }
}

function workspaceDeps(dir, read) {
  const pkg = JSON.parse(read(`${dir}/package.json`))
  return Object.keys({ ...pkg.dependencies, ...pkg.devDependencies }).filter(
    (name) => name.startsWith("@workspace/")
  )
}

export function readChangeGraph(
  read = (rel) => readFileSync(path.join(root, rel), "utf8"),
  list = (rel) => readdirSync(path.join(root, rel))
) {
  const dirs = ["apps", "packages"].flatMap((group) =>
    list(group)
      .map((name) => `${group}/${name}`)
      .filter((dir) => {
        try {
          read(`${dir}/package.json`)
          return true
        } catch {
          return false
        }
      })
  )
  const byName = new Map(
    dirs.map((dir) => [JSON.parse(read(`${dir}/package.json`)).name, dir])
  )
  const reach = (dir, seen = new Set()) => {
    if (seen.has(dir)) return seen
    seen.add(dir)
    for (const name of workspaceDeps(dir, read)) {
      const dep = byName.get(name)
      if (dep) reach(dep, seen)
    }
    return seen
  }
  const parts = {}
  for (const [part, { app, task }] of Object.entries(PART_TASKS)) {
    const turbo = JSON.parse(read(`${app}/turbo.json`))
    const declared = (turbo.tasks?.[task]?.inputs ?? [])
      .filter((input) => input.startsWith("$TURBO_ROOT$/"))
      .map((input) => input.slice("$TURBO_ROOT$/".length))
    parts[part] = [
      ...[...reach(app)].map((dir) => globPattern(`${dir}/**`)),
      ...declared.map(globPattern),
    ]
  }
  return { parts }
}

export function jobPart(jobName) {
  const base = jobName.replace(/ \(.*\)$/, "")
  return (
    Object.entries(PART_JOBS).find(([, jobs]) => jobs.includes(base))?.[0] ??
    null
  )
}

export function replay(prs, jobsOf, graph) {
  return prs.map((pr) => {
    const map = changeMap(pr.files, graph)
    const jobs = jobsOf(pr.number)
    const total = jobs.reduce((sum, job) => sum + job.minutes, 0)
    const saved = jobs
      .filter((job) => {
        const part = jobPart(job.name)
        return part !== null && !map.parts.includes(part)
      })
      .reduce((sum, job) => sum + job.minutes, 0)
    return { number: pr.number, parts: map.parts, total, saved }
  })
}

export function holes(redRuns, filesOf, graph) {
  return redRuns.flatMap((run) => {
    const files = filesOf(run.pr)
    if (!files) return []
    const { parts } = changeMap(files, graph)
    const skippedFailures = run.failed.filter((name) => {
      const part = jobPart(name)
      return part !== null && !parts.includes(part)
    })
    const caughtAnyway = run.failed.some((name) => jobPart(name) === null)
    return skippedFailures.length && !caughtAnyway
      ? [{ pr: run.pr, run: run.run, skippedFailures }]
      : []
  })
}

function minutes(job) {
  return (Date.parse(job.completed_at) - Date.parse(job.started_at)) / 60000
}

function main([command, dir]) {
  if (command !== "replay" || !dir || !existsSync(dir)) {
    console.error(
      "usage: node scripts/change-map.mjs replay <dir with prs.json, runjobs/<pr>.jsonl and red.json>"
    )
    return 2
  }
  const graph = readChangeGraph()
  const prs = JSON.parse(readFileSync(path.join(dir, "prs.json"), "utf8")).map(
    (pr) => ({ number: pr.number, files: pr.files.map((file) => file.path) })
  )
  const jobsOf = (number) =>
    readFileSync(path.join(dir, "runjobs", `${number}.jsonl`), "utf8")
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line))
      .filter((job) => job.started_at && job.completed_at)
      .map((job) => ({ name: job.name, minutes: minutes(job) }))
  const rows = replay(prs, jobsOf, graph)
  const total = rows.reduce((sum, row) => sum + row.total, 0)
  const saved = rows.reduce((sum, row) => sum + row.saved, 0)
  const byParts = new Map()
  for (const row of rows) {
    const key = row.parts.join("+") || "none"
    byParts.set(key, (byParts.get(key) ?? 0) + 1)
  }
  const filesOf = (number) => prs.find((pr) => pr.number === number)?.files
  const red = JSON.parse(readFileSync(path.join(dir, "red.json"), "utf8"))
  console.log(
    JSON.stringify(
      {
        prs: rows.length,
        runnerMinutes: Math.round(total),
        savedMinutes: Math.round(saved),
        savedShare: Math.round((saved / total) * 1000) / 10,
        partsReached: Object.fromEntries(byParts),
        redMainRunsInWindow: red.filter((run) => run.pr !== null).length,
        holes: holes(
          red.filter((run) => run.pr !== null),
          filesOf,
          graph
        ),
      },
      null,
      2
    )
  )
  return 0
}

if (process.argv[1] === fileURLToPath(import.meta.url))
  process.exitCode = main(process.argv.slice(2))
