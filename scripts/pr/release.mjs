// Says whether a merge commit is live in production, from the commit statuses
// Railway posts (`opencv - api`, `opencv - web`) and the sha each service serves.
import { execFileSync } from "node:child_process"
import { parseArgs } from "node:util"
import { writeResult } from "./result.mjs"
import { affectedServices, services } from "./services.mjs"

// Worst first: the overall outcome is the first one any service has.
const severity = ["BROKEN", "RELEASE_BLOCKED", "PENDING", "LIVE"]
const exitCodes = { LIVE: 0, PENDING: 3, BROKEN: 1, RELEASE_BLOCKED: 1 }
const fullSha = /^[0-9a-f]{40}$/
const short = (sha) => sha.slice(0, 7)

// Railway's descriptions: "Railway is deploying the service", "Success - api.opencv.me",
// "No deployment needed - watched paths not modified", "Deployment failed".
export function readStatus({ state, description }) {
  if (state === "failure" || state === "error") return "failed"
  if (state === "pending") return "pending"
  return /^No deployment needed/i.test(description ?? "")
    ? "skipped"
    : "deployed"
}

// Railway said success; the public sha says whether that build is the one users get.
async function serving(service, commit, final, io) {
  const unconfirmed = (detail) => ({
    outcome: final ? "RELEASE_BLOCKED" : "PENDING",
    detail,
  })
  let live
  try {
    live = service.parseSha((await io.fetch(service.shaUrl)).body)
  } catch (error) {
    return unconfirmed(
      `Railway succeeded but ${service.shaUrl} is unreadable: ${error.message}`
    )
  }
  if (live !== commit) {
    const contains = fullSha.test(live ?? "") && io.isAncestor(commit, live)
    if (contains === null)
      return unconfirmed(
        `Railway succeeded but cannot tell: served commit ${short(live)} not in this clone`
      )
    if (!contains)
      return unconfirmed(
        `Railway succeeded but ${service.shaUrl} serves ${short(String(live))}, not ${short(commit)}`
      )
  }
  const via =
    live === commit ? "serves it" : `serves ${short(live)}, which contains it`
  if (!service.deepUrl) return { outcome: "LIVE", detail: via }
  const deep = await io
    .fetch(service.deepUrl)
    .catch((error) => ({ status: 0, body: error.message }))
  if (deep.status === 200)
    return { outcome: "LIVE", detail: `${via}, ${service.deepUrl} ok` }
  return {
    outcome: "BROKEN",
    detail: `${via} but ${service.deepUrl} answered ${deep.status || "nothing"}: ${deep.body.slice(0, 120)}`,
  }
}

async function classify(service, commit, affected, status, final, io) {
  if (!status)
    return { outcome: "PENDING", detail: "Railway has not posted a status yet" }
  const railway = `Railway said "${status.description}"`
  const notAffected = { outcome: "LIVE", detail: "not affected by this commit" }
  switch (readStatus(status)) {
    case "failed":
      return { outcome: "BROKEN", detail: railway }
    case "pending":
      return { outcome: "PENDING", detail: railway }
    case "skipped":
      return affected
        ? {
            outcome: "RELEASE_BLOCKED",
            detail: `changed files rebuild it but ${railway}`,
          }
        : notAffected
    default:
      return affected ? serving(service, commit, final, io) : notAffected
  }
}

// io: { changedFiles(sha), statuses(sha) newest first, fetch(url) -> {status, body},
//       isAncestor(a, b) -> true|false|null (null: b is not in this clone), now(), sleep(ms) }
export async function release({ commit, wait = 0 }, io) {
  const affected = new Set(
    affectedServices(io.changedFiles(commit)).map((s) => s.name)
  )
  const deadline = io.now() + wait * 1000
  let delay = 5000
  for (;;) {
    const final = io.now() >= deadline
    const reports = []
    let statuses
    let unread
    try {
      statuses = io.statuses(commit)
    } catch (error) {
      unread = {
        outcome: "PENDING",
        detail: `cannot read commit statuses from GitHub: ${error.message}`,
      }
    }
    for (const service of services) {
      const isAffected = affected.has(service.name)
      reports.push({
        service: service.name,
        affected: isAffected,
        ...(unread ??
          (await classify(
            service,
            commit,
            isAffected,
            statuses.find((s) => s.context === service.context),
            final,
            io
          ))),
      })
    }
    const outcome = severity.find((o) => reports.some((r) => r.outcome === o))
    if (outcome !== "PENDING" || final)
      return { commit, outcome, services: reports }
    await io.sleep(Math.min(delay, deadline - io.now()))
    delay = Math.min(delay * 1.5, 30_000)
  }
}

export function format({ commit, outcome, services: reports }) {
  const lines = reports.map(
    (r) => `${r.service.padEnd(4)} ${r.outcome.padEnd(15)} ${r.detail}`
  )
  lines.push(`RELEASE ${outcome} commit ${short(commit)}`)
  return lines.join("\n")
}

const git = (args) =>
  execFileSync("git", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  })

// null when production serves a commit this clone lacks even after a fetch.
export const isAncestorWith = (run) => (ancestor, descendant) => {
  const ask = () => {
    try {
      run(["merge-base", "--is-ancestor", ancestor, descendant])
      return true
    } catch (error) {
      if (error.status === 1) return false
      throw error
    }
  }
  try {
    return ask()
  } catch {
    try {
      run(["fetch", "--quiet", "origin"])
      return ask()
    } catch {
      return null
    }
  }
}

const liveIo = {
  changedFiles: (commit) =>
    git(["diff", "--name-only", `${commit}^1`, commit])
      .split("\n")
      .filter(Boolean),
  // GitHub lists a commit's statuses newest first; one page of 100 covers both services.
  statuses: (commit) =>
    JSON.parse(
      execFileSync(
        "gh",
        ["api", `repos/{owner}/{repo}/commits/${commit}/statuses?per_page=100`],
        { encoding: "utf8", timeout: 30_000, stdio: ["ignore", "pipe", "pipe"] }
      )
    ),
  async fetch(url) {
    const response = await fetch(url, {
      headers: {
        "Cache-Control": "no-cache",
        "User-Agent": "curl/8.0 opencv-release",
      },
      signal: AbortSignal.timeout(15_000),
      redirect: "error",
    })
    return { status: response.status, body: await response.text() }
  },
  isAncestor: isAncestorWith(git),
  now: Date.now,
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
}

const maxWait = 3600
const usage = "Usage: scripts/pr.mjs release <sha> [--wait <seconds>] [--json]"

export async function runCli(args, io = liveIo) {
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: { wait: { type: "string" }, json: { type: "boolean" } },
  })
  const wait = Number(values.wait ?? 0)
  if (positionals.length !== 1 || !Number.isFinite(wait) || wait < 0)
    throw new Error(usage)
  if (wait > maxWait)
    throw new Error(`--wait is at most ${maxWait} seconds. ${usage}`)
  let commit
  try {
    commit = git([
      "rev-parse",
      "--verify",
      "--quiet",
      `${positionals[0]}^{commit}`,
    ]).trim()
  } catch {
    throw new Error(
      `commit ${positionals[0]} is not in this clone. Run git fetch first.`
    )
  }
  const id = short(commit)
  const startedAt = new Date()
  try {
    const result = await release({ commit, wait }, io)
    console.log(values.json ? JSON.stringify(result, null, 2) : format(result))
    const detail = result.services
      .map((r) => `${r.service} ${r.outcome} (${r.detail})`)
      .join("; ")
    const file = writeResult({
      script: "release",
      id,
      status: result.outcome === "LIVE" ? "ok" : "fail",
      cause: "deploy",
      detail: `${result.outcome} ${id}: ${detail}`,
      next:
        result.outcome === "PENDING"
          ? `node scripts/pr.mjs release ${commit} --wait 600`
          : null,
      startedAt,
    })
    console.log(`RESULT_JSON: ${file}`)
    return exitCodes[result.outcome]
  } catch (error) {
    // Replaces any earlier result for this commit so nobody reads it as current.
    console.error(`ERROR pr release: ${error.message}`)
    const file = writeResult({
      script: "release",
      id,
      status: "error",
      cause: "env",
      detail: `release check crashed: ${error.message}`,
      startedAt,
    })
    console.log(`RESULT_JSON: ${file}`)
    return 1
  }
}
