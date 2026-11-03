#!/usr/bin/env node
import { execFileSync } from "node:child_process"
import { fileURLToPath } from "node:url"

const STAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z ?/
const ANSI = /\u001b\[[0-9;]*[A-Za-z]/g
const ERROR = /✖|FAIL |AssertionError|\bError:|not ok|##\[error\]/
const GENERIC = /##\[error\]Process completed with exit code \d+/
const TEST_FILE = /((?:[\w.@+-]+\/)*[\w.@+-]+\.(?:test|spec)\.[cm]?[jt]sx?)/
const MARK = /^##\[[^\]]+\]\s*/
const CALL = /node scripts\/ci-first-errors\.mjs/
const WHEN_FAILED = /contains\(needs\.\*\.result, 'failure'\)/
const CLIP = 500

export function visibleLine(raw) {
  return String(raw)
    .replace(/^\uFEFF/, "")
    .replace(ANSI, "")
    .replace(STAMP, "")
    .trim()
}

function repoFile(match) {
  const at = match.search(/(?:apps|packages|scripts)\//)
  return at === -1 ? match : match.slice(at)
}

function clip(line) {
  return line.length > CLIP ? `${line.slice(0, CLIP)}…` : line
}

export function firstError(log) {
  const lines = String(log)
    .split(/\r?\n/)
    .map(visibleLine)
    .filter((line) => line.length > 0)
  const index = lines.findIndex(
    (line) => ERROR.test(line) && !GENERIC.test(line)
  )
  if (index === -1) return null
  const line = clip(lines[index].replace(MARK, "").trim())
  const from = Math.max(0, index - 8)
  const to = Math.min(lines.length, index + 40)
  let file = null
  let best = Infinity
  for (let i = from; i < to; i++) {
    const found = TEST_FILE.exec(lines[i])
    if (!found) continue
    const distance = Math.abs(i - index)
    if (distance < best) {
      best = distance
      file = repoFile(found[1])
    }
  }
  return { line, file }
}

export function reportLine(name, log) {
  const hit = firstError(log)
  if (!hit) return `${name}: no error line`
  if (hit.file && !hit.line.includes(hit.file))
    return `${name}: ${hit.file}: ${hit.line}`
  return `${name}: ${hit.line}`
}

function ciJob(text) {
  const jobsAt = text.search(/^jobs:\s*$/m)
  const jobs = jobsAt === -1 ? "" : text.slice(jobsAt)
  const start = jobs.search(/^ {2}ci:\s*$/m)
  if (start === -1) return null
  const rest = jobs.slice(start + 1)
  const next = rest.search(/^ {2}[a-z][a-z0-9-]*:\s*$/m)
  return next === -1 ? rest : rest.slice(0, next)
}

export function detect(text, file) {
  if (!String(file).endsWith(".github/workflows/ci.yml")) return []
  const ci = ciJob(String(text))
  if (!ci || !CALL.test(ci) || !WHEN_FAILED.test(ci))
    return ["ci job does not print the first error of each failed job"]
  return []
}

export function commandEnv(env) {
  const token = env.GITHUB_TOKEN || env.GH_TOKEN
  if (!token) throw new Error("GITHUB_TOKEN is not set")
  return { ...env, GH_TOKEN: token, GITHUB_TOKEN: token }
}

function gh(args, env) {
  return execFileSync("gh", args, {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    env: commandEnv(env),
  })
}

function failedJobs(listed) {
  return String(listed)
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.includes("\t"))
    .map((line) => {
      const tab = line.indexOf("\t")
      return { name: line.slice(0, tab), id: line.slice(tab + 1) }
    })
}

export function collect(env, exec = gh) {
  const runId = env.GITHUB_RUN_ID
  if (!runId) throw new Error("GITHUB_RUN_ID is not set")
  const repo = env.GITHUB_REPOSITORY
  if (!repo) throw new Error("GITHUB_REPOSITORY is not set")
  if (!env.GITHUB_TOKEN && !env.GH_TOKEN)
    throw new Error("GITHUB_TOKEN is not set")
  let listed
  try {
    listed = exec(
      [
        "api",
        `repos/${repo}/actions/runs/${runId}/jobs`,
        "--jq",
        '.jobs[] | select(.conclusion=="failure") | [.name, (.id|tostring)] | @tsv',
      ],
      env
    )
  } catch {
    return ["ci: could not list failed jobs"]
  }
  const lines = []
  for (const job of failedJobs(listed)) {
    try {
      const log = exec(
        [
          "api",
          "--allow-escape-sequences",
          `repos/${repo}/actions/jobs/${job.id}/logs`,
        ],
        env
      )
      lines.push(reportLine(job.name, log))
    } catch {
      lines.push(`${job.name}: could not read the log`)
    }
  }
  return lines
}

function main() {
  try {
    for (const line of collect(process.env)) console.log(line)
  } catch (error) {
    console.error(error.message)
    return 1
  }
  return 0
}

if (process.argv[1] === fileURLToPath(import.meta.url))
  process.exitCode = main()
