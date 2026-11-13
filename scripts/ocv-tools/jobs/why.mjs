import { firstError, visibleLine } from "../../ci-first-errors.mjs"
import { json, gh, run } from "./common.mjs"

export const WHY_LINE_LIMIT = 30
const CASES_PER_JOB = 3
const SHOWN = 220
const CI_WORKFLOW = ".github/workflows/ci.yml"
const AGGREGATE_JOB = "ci"
const VITEST_FAIL =
  /^FAIL\s+(?:\S+\s+)?((?:[\w.@+-]+\/)*[\w.@+-]+\.(?:test|spec)\.[cm]?[jt]sx?)(?:\s+>\s+(.*))?$/
const TURBO_DIR =
  /#test:\s+ERROR\s+command \(\S*?\/((?:apps|packages)\/[\w.-]+)\)/
const JOB_DIR = { "test-web": "apps/web", "test-api": "apps/api" }
const SCRIPT_TEST = /^scripts\/\S+\.test\.mjs$/

const shorten = (text) =>
  text.length > SHOWN ? `${text.slice(0, SHOWN - 1)}…` : text

export function caseLine(line) {
  const at = line.indexOf(" — ")
  if (at === -1) return shorten(line)
  const name = line.slice(0, at).split(" > ").at(-1).trim()
  return shorten(`${line.slice(at + 3)} (${name})`)
}

export function ciRunOf(ctx, repo, head) {
  const runs =
    json(ctx, "api", `repos/${repo}/actions/runs?head_sha=${head}&per_page=30`)
      .workflow_runs ?? []
  const ci = runs.filter((r) => !r.path || r.path.startsWith(CI_WORKFLOW))
  const newest = (list) => [...list].sort((a, b) => b.id - a.id)[0] ?? null
  return (
    newest(ci.filter((r) => r.event === "pull_request")) ?? newest(ci) ?? null
  )
}

function packageDir(job, lines) {
  for (const line of lines) {
    const found = TURBO_DIR.exec(line)
    if (found) return found[1]
  }
  return JOB_DIR[job.name.replace(/\s*\(.*\)$/, "")] ?? null
}

export function reproOf(file, dir, runId, job) {
  if (file && SCRIPT_TEST.test(file)) return `node --test ${file}`
  if (file && dir) {
    const inside = file.startsWith(`${dir}/`)
      ? file.slice(dir.length + 1)
      : file
    return `pnpm --dir ${dir} exec vitest run ${inside}`
  }
  return `gh run view ${runId} --job ${job.id} --log-failed | tail -80`
}

function repoPath(file, dir) {
  if (!file) return null
  if (/^(?:apps|packages|scripts)\//.test(file)) return file
  return dir ? `${dir}/${file}` : file
}

export function failingCases(job, log, runId) {
  const lines = String(log)
    .split(/\r?\n/)
    .map(visibleLine)
    .filter(Boolean)
    .map((line) => line.replace(/^##\[[^\]]+\]\s*/, ""))
  const dir = packageDir(job, lines)
  const cases = []
  const seen = new Set()
  const first = firstError(log)
  if (first) {
    const file = repoPath(first.file, dir)
    seen.add(file ?? first.line)
    cases.push({
      file,
      line: first.line,
      repro: reproOf(file, dir, runId, job),
    })
  }
  for (const line of lines) {
    if (cases.length >= CASES_PER_JOB) break
    const hit = VITEST_FAIL.exec(line)
    if (!hit) continue
    const file = repoPath(hit[1], dir)
    if (seen.has(file)) continue
    seen.add(file)
    cases.push({ file, line, repro: reproOf(file, dir, runId, job) })
  }
  return cases
}

function annotationCase(ctx, repo, job, runId) {
  const notes = run(ctx, "gh", [
    "api",
    `repos/${repo}/check-runs/${job.id}/annotations`,
  ])
  let message = null
  try {
    message =
      JSON.parse(notes.out || "[]").find(
        (note) => note.annotation_level === "failure"
      )?.message ?? null
  } catch {
    message = null
  }
  return {
    file: null,
    line: message ?? "the job has no log and no failure note",
    repro: reproOf(null, null, runId, job),
  }
}

function casesOfJob(ctx, repo, job, runId) {
  if (!job.steps?.length) return [annotationCase(ctx, repo, job, runId)]
  const log = run(ctx, "gh", [
    "api",
    "--allow-escape-sequences",
    `repos/${repo}/actions/jobs/${job.id}/logs`,
  ])
  if (!log.ok) return [annotationCase(ctx, repo, job, runId)]
  const cases = failingCases(job, log.out, runId)
  return cases.length
    ? cases
    : [
        {
          file: null,
          line: "no error line in the log",
          repro: reproOf(null, null, runId, job),
        },
      ]
}

export function whyLines({ pr, head, ciRun, jobs, casesOf }) {
  if (!ciRun)
    return [
      `PR #${pr}: no ci run on ${head.slice(0, 12)} yet. Push, or wait for GitHub to start it.`,
    ]
  const done = jobs.filter((job) => job.status === "completed")
  const failed = jobs.filter((job) =>
    ["failure", "timed_out", "startup_failure"].includes(job.conclusion)
  )
  const real = failed.filter((job) => job.name !== AGGREGATE_JOB)
  const shown = real.length ? real : failed
  const running = ciRun.status !== "completed"
  const head12 = head.slice(0, 12)
  const lines = []
  if (running)
    lines.push(
      `ci run ${ciRun.id} on ${head12} is not finished: ${done.length} of ${jobs.length} jobs done. ${shown.length ? "Failures so far:" : "No failure so far."}`
    )
  else if (!shown.length && ciRun.conclusion === "success")
    return [`ci run ${ciRun.id} on ${head12} is green.`]
  else
    lines.push(
      `ci run ${ciRun.id} on ${head12} ${ciRun.conclusion ?? "ended"}: ${shown.length} failed job${shown.length === 1 ? "" : "s"}.`
    )
  for (const job of shown) {
    const cases = casesOf(job)
    const files = [...new Set(cases.map((c) => c.file).filter(Boolean))]
    lines.push(
      `${job.name} failed${files.length ? `: ${files.join(", ")}` : ""}`
    )
    for (const item of cases) {
      lines.push(`  ${caseLine(item.line)}`)
      lines.push(`  repro: ${item.repro}`)
    }
  }
  if (lines.length <= WHY_LINE_LIMIT) return lines
  const kept = lines.slice(0, WHY_LINE_LIMIT - 1)
  return [
    ...kept,
    `… ${lines.length - kept.length} more lines: gh run view ${ciRun.id} --log-failed | tail -200`,
  ]
}

export function why(ctx, pr) {
  const pull = json(
    ctx,
    "pr",
    "view",
    String(pr),
    "--json",
    "number,headRefOid"
  )
  const repo = gh(
    ctx,
    "repo",
    "view",
    "--json",
    "nameWithOwner",
    "--jq",
    ".nameWithOwner"
  )
  const ciRun = ciRunOf(ctx, repo, pull.headRefOid)
  const jobs = ciRun
    ? (json(
        ctx,
        "api",
        `repos/${repo}/actions/runs/${ciRun.id}/jobs?per_page=100`
      ).jobs ?? [])
    : []
  return whyLines({
    pr,
    head: pull.headRefOid,
    ciRun,
    jobs,
    casesOf: (job) => casesOfJob(ctx, repo, job, ciRun.id),
  })
}
