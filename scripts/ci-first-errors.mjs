#!/usr/bin/env node
import { execFileSync } from "node:child_process"
import { fileURLToPath } from "node:url"

const STAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z ?/
const ANSI = /\u001b\[[0-9;]*[A-Za-z]/g
const GENERIC =
  /##\[error\]Process completed with exit code \d+|command \(.*\) exited \(\d+\)|ERROR\s+run failed/
const PRIMARY = /^(?:FAIL |not ok(?:\s|$)|✖(?! failing tests:))/
const ASSERTION = /AssertionError|\bError:/
const MARK = /^##\[[^\]]+\]\s*/
const TEST_FILE = /((?:[\w.@+-]+\/)*[\w.@+-]+\.(?:test|spec)\.[cm]?[jt]sx?)/
const CALL = /node scripts\/ci-first-errors\.mjs/
const WHEN_FAILED = /contains\(needs\.\*\.result, 'failure'\)/
const ANNOTATION = '.[] | select(.annotation_level=="failure") | .message'
const CLIP = 500
const NEAR = 6

export function visibleLine(raw) {
  return String(raw)
    .replace(/^\uFEFF/, "")
    .replace(ANSI, "")
    .replace(STAMP, "")
    .trim()
}

function body(line) {
  return line.replace(MARK, "").trim()
}

function generic(line) {
  return GENERIC.test(line) || GENERIC.test(body(line))
}

function repoFile(match) {
  const at = match.search(/(?:apps|packages|scripts)\//)
  return at === -1 ? match : match.slice(at)
}

function clip(line) {
  return line.length > CLIP ? `${line.slice(0, CLIP)}…` : line
}

function followingAssertion(lines, index) {
  const end = Math.min(lines.length, index + 1 + NEAR)
  for (let i = index + 1; i < end; i++) {
    if (generic(lines[i])) continue
    if (ASSERTION.test(body(lines[i]))) return i
  }
  return -1
}

function primaryIndex(lines) {
  const found = []
  for (let i = 0; i < lines.length; i++) {
    if (generic(lines[i])) continue
    if (PRIMARY.test(body(lines[i]))) found.push(i)
  }
  return (
    found.find((index) => followingAssertion(lines, index) !== -1) ?? found[0]
  )
}

export function firstError(log) {
  const lines = String(log)
    .split(/\r?\n/)
    .map(visibleLine)
    .filter((line) => line.length > 0)
  let index = primaryIndex(lines)
  let paired = -1
  if (index === undefined) {
    index = lines.findIndex(
      (line) => line.startsWith("##[error]") && !generic(line)
    )
    if (index === -1)
      index = lines.findIndex(
        (line) => ASSERTION.test(body(line)) && !generic(line)
      )
  } else paired = followingAssertion(lines, index)
  if (index === undefined || index === -1) return null
  const main = body(lines[index])
  const extra = paired === -1 ? "" : body(lines[paired])
  const line = clip(extra ? `${main} — ${extra}` : main)
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
      const [name, id, steps] = line.split("\t")
      return {
        name,
        id,
        steps: steps === undefined || steps === "" ? null : Number(steps),
      }
    })
}

function isNotFound(error) {
  const stderr = error?.stderr
  const text = Buffer.isBuffer(stderr)
    ? stderr.toString("utf8")
    : String(stderr ?? "")
  return /\b404\b/.test(
    `${error?.status ?? ""} ${text} ${error?.message ?? ""}`
  )
}

function annotationLine(job, repo, env, exec) {
  try {
    const raw = exec(
      [
        "api",
        `repos/${repo}/check-runs/${job.id}/annotations`,
        "--jq",
        ANNOTATION,
      ],
      env
    )
    const message = String(raw)
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find((line) => line.length > 0)
    if (message) return `${job.name}: ${clip(message)}`
  } catch {
    return `${job.name}: could not read the log`
  }
  return `${job.name}: could not read the log`
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
        '.jobs[] | select(.conclusion=="failure") | [.name, (.id|tostring), ((.steps // [])|length|tostring)] | @tsv',
      ],
      env
    )
  } catch {
    return ["ci: could not list failed jobs"]
  }
  const lines = []
  for (const job of failedJobs(listed)) {
    if (job.steps === 0) {
      lines.push(annotationLine(job, repo, env, exec))
      continue
    }
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
    } catch (error) {
      lines.push(
        isNotFound(error)
          ? annotationLine(job, repo, env, exec)
          : `${job.name}: could not read the log`
      )
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
