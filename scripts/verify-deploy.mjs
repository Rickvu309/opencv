#!/usr/bin/env node
// Usage: node scripts/verify-deploy.mjs --commit <full merge sha> [--wait <seconds>]
// Reports, per Railway service, whether production runs that commit.
// Exit codes: 0 every service DEPLOYED or NOT_EXPECTED, 3 a service is still
// DEPLOYING (rerun later), 1 a service FAILED or the check could not run.
import { execFileSync } from "node:child_process"
import { parseArgs } from "node:util"
import { pathToFileURL } from "node:url"
import { cli, healthStatus, listDeployments } from "./lib/railway-deploy.mjs"

// Must match .railway/railway.ts; verify-deploy.test.mjs asserts it.
export const services = [
  {
    name: "api",
    origin: "https://api.opencv.me",
    watchPatterns: [
      "apps/api/**",
      "packages/**",
      "pnpm-lock.yaml",
      "pnpm-workspace.yaml",
      "package.json",
      "turbo.json",
    ],
  },
  {
    name: "web",
    origin: "https://opencv.me",
    watchPatterns: [
      "apps/web/**",
      "packages/ui/**",
      "packages/domain/**",
      "pnpm-lock.yaml",
    ],
  },
]

// Worst outcome decides the exit code; no entry means every service is fine.
const exitCodes = [
  ["FAILED", 1],
  ["DEPLOYING", 3],
]

const inProgress = new Set([
  "INITIALIZING",
  "QUEUED",
  "WAITING",
  "BUILDING",
  "DEPLOYING",
])

const waitIntervalMs = 15_000

function matchesPattern(pattern, file) {
  const source = pattern
    .split("**")
    .map((part) =>
      part.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "[^/]*")
    )
    .join(".*")
  return new RegExp(`^${source}$`).test(file)
}

const short = (sha) => sha.slice(0, 7)

function expectsDeploy(service, changedFiles) {
  return changedFiles.some((file) =>
    service.watchPatterns.some((pattern) => matchesPattern(pattern, file))
  )
}

async function classify(service, commit, changedFiles, io) {
  if (!expectsDeploy(service, changedFiles))
    return {
      outcome: "NOT_EXPECTED",
      detail: "no changed file matches the service watch patterns",
    }
  const deployments = listDeployments(service.name, io)
  const ours = deployments.find((d) => d.meta?.commitHash === commit)
  const running = deployments.find((d) => d.status === "SUCCESS")
  const runs = `production runs ${short(running?.meta?.commitHash ?? "unknown")}`
  if (!ours)
    return {
      outcome: "FAILED",
      detail: `no deployment for this commit; ${runs}`,
    }
  if (inProgress.has(ours.status))
    return {
      outcome: "DEPLOYING",
      detail: `deployment ${short(ours.id)} is ${ours.status}`,
    }
  if (ours.status !== "SUCCESS" || running.id !== ours.id)
    return {
      outcome: "FAILED",
      detail: `deployment ${short(ours.id)} is ${ours.status}; ${runs}`,
    }
  const health = await io.health(service.origin)
  if (health !== 200)
    return {
      outcome: "FAILED",
      detail: `deployment ${short(ours.id)} succeeded but /health returned HTTP ${health}`,
    }
  return {
    outcome: "DEPLOYED",
    detail: `deployment ${short(ours.id)} succeeded, /health 200`,
  }
}

export async function verifyDeploy({ commit, wait = 0 }, io) {
  if (!/^[a-f0-9]{40}$/.test(commit ?? ""))
    throw new Error("Use --commit with the full 40-character merge commit SHA.")
  const changedFiles = io.changedFiles(commit)
  const deadline = io.now() + wait * 1000
  for (;;) {
    const results = []
    for (const service of services)
      results.push({
        service: service.name,
        ...(await classify(service, commit, changedFiles, io)),
      })
    const states = new Set(results.map((r) => r.outcome))
    if (!states.has("DEPLOYING") || io.now() >= deadline) {
      const exitCode = exitCodes.find(([state]) => states.has(state))?.[1] ?? 0
      return { results, exitCode }
    }
    await io.sleep(waitIntervalMs)
  }
}

export function report(commit, { results, exitCode }) {
  const lines = results.map(
    (r) => `${r.service.padEnd(4)} ${r.outcome.padEnd(12)} ${r.detail}`
  )
  const label = { 0: "OK", 1: "FAILED", 3: "DEPLOYING" }[exitCode]
  lines.push(`RESULT ${label} commit ${short(commit)}`)
  if (exitCode === 3)
    lines.push(
      `Rerun: node scripts/verify-deploy.mjs --commit ${commit} --wait 600`
    )
  return lines.join("\n")
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

function changedFiles(commit) {
  return execFileSync("git", ["diff", "--name-only", `${commit}^`, commit], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  })
    .split("\n")
    .filter(Boolean)
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    const { values } = parseArgs({
      options: { commit: { type: "string" }, wait: { type: "string" } },
    })
    const wait = Number(values.wait ?? 0)
    if (!Number.isFinite(wait) || wait < 0)
      throw new Error("Use --wait with a number of seconds.")
    const result = await verifyDeploy(
      { commit: values.commit, wait },
      { cli, health: healthStatus, changedFiles, now: Date.now, sleep }
    )
    console.log(report(values.commit, result))
    process.exitCode = result.exitCode
  } catch (error) {
    console.error(`ERROR verify-deploy: ${error.message}`)
    process.exitCode = 1
  }
}
