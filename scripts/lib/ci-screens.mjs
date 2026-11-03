import { expiredPending } from "./pending-fixes.mjs"

export const RUNS_FILE = "scripts/ci-screens.runs.json"

const OWN_STACK_FIELDS = ["port", "shotsEnv", "timeoutMinutes", "verdict"]

export function runProblems(runs, scriptExists) {
  if (!Array.isArray(runs)) return [`${RUNS_FILE} is not a list of runs.`]
  const problems = []
  const seen = new Set()
  for (const run of runs) {
    const where = `${RUNS_FILE}: ${run.id ?? "a run with no id"}`
    if (typeof run.id !== "string" || !run.id)
      problems.push(`${where} has no id.`)
    if (seen.has(run.id)) problems.push(`${where} is listed twice.`)
    seen.add(run.id)
    if (!scriptExists(run.script ?? ""))
      problems.push(`${where} names no driver script that exists.`)
    if (run.extra !== undefined && !Array.isArray(run.extra))
      problems.push(`${where} has extra arguments that are not a list.`)
    if (run.stack === "own") {
      for (const field of OWN_STACK_FIELDS)
        if (run[field] === undefined)
          problems.push(`${where} runs its own stack but has no ${field}.`)
      if (!["frames", "exit"].includes(run.verdict))
        problems.push(
          `${where} has verdict ${run.verdict}, not frames or exit.`
        )
    } else if (run.stack !== "shared") {
      problems.push(`${where} has stack ${run.stack}, not own or shared.`)
    }
  }
  return problems
}

export const PEN_LAYOUT_LINE =
  /^(PASS|FAIL) (\S+) (\S+): \d+ texts, \d+ mismatches$/

export function parsePenLayout(output) {
  return output
    .split("\n")
    .map((line) => PEN_LAYOUT_LINE.exec(line))
    .filter(Boolean)
    .map((match) => ({
      id: `pen-layout:${match[2]}`,
      status: match[1] === "PASS" ? "pass" : "fail",
      detail: match[3],
    }))
}

export function judge({ results, skips, today }) {
  const lines = []
  let failed = false
  const fail = (line) => {
    failed = true
    lines.push(`FAIL ${line}`)
  }
  const expired = new Set(
    expiredPending(
      skips.map((skip) => ({ ...skip, file: skip.id })),
      today
    ).map((entry) => entry.id)
  )
  const skipById = new Map(skips.map((skip) => [skip.id, skip]))
  const seen = new Set()
  for (const result of results) {
    seen.add(result.id)
    const skip = skipById.get(result.id)
    const label = result.detail ? `${result.id} ${result.detail}` : result.id
    if (result.status === "error") {
      fail(`${label}: the driver did not produce a verdict`)
    } else if (result.status === "pass") {
      if (skip)
        fail(
          `${label}: STALE SKIP, this screen passes again, remove its entry (${skip.issue})`
        )
      else lines.push(`PASS ${label}`)
    } else if (!skip) {
      fail(label)
    } else if (expired.has(result.id)) {
      fail(
        `${label}: SKIP EXPIRED on ${skip.expires}, fix the screen or renew the entry (${skip.issue})`
      )
    } else {
      lines.push(
        `SKIPPED ${label}: ${skip.reason}. Fails on main, tracked in ${skip.issue}, skip ends ${skip.expires}`
      )
    }
  }
  const verdictless = results.some((result) => result.status === "error")
  if (!verdictless) {
    for (const skip of skips) {
      if (!seen.has(skip.id))
        fail(`${skip.id}: skip names a screen no driver reported, remove it`)
    }
  }
  return { lines, failed }
}
