#!/usr/bin/env node
import { execFileSync } from "node:child_process"
import { pathToFileURL } from "node:url"
import { LABELS } from "./ocv-tools/rules/merge-gate.mjs"

export const MAIN_RED_TITLE = "Main is red"
const RED_COMMIT = /^Red commit: ([0-9a-f]{40})$/gm

export function redCommits(texts) {
  const found = []
  for (const text of texts)
    for (const match of String(text ?? "").matchAll(RED_COMMIT))
      if (!found.includes(match[1])) found.push(match[1])
  return found
}

export function revertCommand({ sha, parent }) {
  return `node scripts/production-revert.mjs ${sha} --good ${parent} --apply`
}

export function rerunCommand({ runUrl }) {
  const run = /\/actions\/runs\/(\d+)/.exec(String(runUrl ?? ""))?.[1]
  return run ? `gh run rerun ${run} --failed` : null
}

export const RED_LIMIT = Object.freeze({ runs: 30, red: 3 })

export function wentRed(run) {
  return run.conclusion === "failure" || Number(run.attempt) > 1
}

export function redRateLine(runs, limit = RED_LIMIT) {
  const seen = runs.slice(0, limit.runs)
  const red = seen.filter(wentRed).length
  const over = red > limit.red
  return `Main went red in ${red} of its last ${seen.length} runs. The limit is ${limit.red} in ${limit.runs}.${over ? " That is over the limit: fix what makes main red before adding work, or bring back a second check before the merge (docs/adr/0003-merge-is-a-production-deploy.md)." : ""}`
}

export function attemptLine(attempt) {
  return Number(attempt) > 1
    ? `This is attempt ${attempt}: the run already ran again and failed again, so it is not a chance failure.`
    : "The failed jobs run again once by themselves. A green second attempt closes this issue."
}

export function redReport({ sha, parent, runUrl, attempt = 1, runs = null }) {
  const rerun = rerunCommand({ runUrl })
  return [
    `The full ci run on main failed after ${sha}. Until main is green again, only a pull request labeled ${LABELS.productionRedRevert} merges, and production keeps the last green commit.`,
    "",
    `Red commit: ${sha}`,
    "",
    `Run: ${runUrl}`,
    "",
    attemptLine(attempt),
    "",
    ...(runs ? [redRateLine(runs), ""] : []),
    "Revert it from the main checkout:",
    "",
    "```",
    revertCommand({ sha, parent }),
    "```",
    "",
    ...(rerun
      ? [
          "If the failure does not come from this commit, run the failed jobs again. A green second attempt closes this issue and approves the deploy:",
          "",
          "```",
          rerun,
          "```",
          "",
        ]
      : []),
    "The next green run on main that contains every red commit named here closes this issue.",
  ].join("\n")
}

export function mainRedActions({
  result,
  sha,
  parent,
  runUrl,
  open,
  contains,
  attempt = 1,
  runs = null,
}) {
  if (result === "failure" && attempt < 2)
    return [
      {
        do: "wait",
        line: `ci failed on ${sha} at attempt ${attempt}; the failed jobs run again once by themselves, and main-red opens only if that second attempt fails too`,
      },
    ]
  if (result === "failure") {
    const body = redReport({ sha, parent, runUrl, attempt, runs })
    const oldest = [...open].sort((a, b) => a.number - b.number)[0]
    return oldest
      ? [{ do: "comment", number: oldest.number, body }]
      : [{ do: "open", title: MAIN_RED_TITLE, body }]
  }
  if (result !== "success") return []
  return open.map((issue) => {
    const missing = issue.redCommits.filter((red) => !contains(red))
    return missing.length
      ? { do: "keep", number: issue.number, missing }
      : {
          do: "close",
          number: issue.number,
          body: `Main is green again: the ci run at ${sha} passed and contains every red commit named here.\n\nRun: ${runUrl}`,
        }
  })
}

function liveIo() {
  const run = (command, args) =>
    execFileSync(command, args, {
      encoding: "utf8",
      timeout: 60_000,
      stdio: ["ignore", "pipe", "pipe"],
    })
  return {
    git: (args) => run("git", args),
    gh: (args) => run("gh", args),
    out: (line) => process.stdout.write(`${line}\n`),
  }
}

function ensureLabel(io) {
  try {
    io.gh(["label", "create", LABELS.mainRed, "--color", "b60205"])
  } catch (error) {
    if (!/already exists/.test(String(error.stderr ?? error.message)))
      throw error
  }
}

export function main(env, io) {
  const result = env.CI_RESULT ?? ""
  const sha = env.GITHUB_SHA ?? ""
  const runUrl = env.RUN_URL ?? ""
  if (!/^[0-9a-f]{40}$/.test(sha))
    throw new Error("GITHUB_SHA must be a full commit")
  const listed = JSON.parse(
    io.gh([
      "issue",
      "list",
      "--label",
      LABELS.mainRed,
      "--state",
      "open",
      "--json",
      "number,body,comments",
      "--limit",
      "20",
    ])
  )
  const open = listed.map((issue) => ({
    number: issue.number,
    redCommits: redCommits([
      issue.body,
      ...(issue.comments ?? []).map((comment) => comment.body),
    ]),
  }))
  const parent =
    result === "failure" ? io.git(["rev-parse", `${sha}^`]).trim() : null
  const attempt = Number(env.RUN_ATTEMPT ?? 1) || 1
  const runs =
    result === "failure"
      ? [
          { conclusion: "failure", attempt },
          ...JSON.parse(
            io.gh([
              "run",
              "list",
              "--workflow",
              "ci.yml",
              "--event",
              "push",
              "--branch",
              "main",
              "--status",
              "completed",
              "--limit",
              String(RED_LIMIT.runs),
              "--json",
              "conclusion,attempt",
            ])
          ),
        ]
      : null
  const contains = (red) => {
    try {
      io.git(["merge-base", "--is-ancestor", red, sha])
      return true
    } catch {
      return false
    }
  }
  const actions = mainRedActions({
    result,
    sha,
    parent,
    runUrl,
    open,
    contains,
    attempt,
    runs,
  })
  if (!actions.length)
    io.out(`ci is ${result || "unknown"} on ${sha}; no main-red change`)
  for (const action of actions) {
    if (action.do === "open") {
      ensureLabel(io)
      io.gh([
        "issue",
        "create",
        "--title",
        action.title,
        "--label",
        LABELS.mainRed,
        "--body",
        action.body,
      ])
      io.out(`opened a ${LABELS.mainRed} issue for ${sha}`)
    } else if (action.do === "comment") {
      io.gh(["issue", "comment", String(action.number), "--body", action.body])
      io.out(`added ${sha} to #${action.number}`)
    } else if (action.do === "wait") {
      io.out(action.line)
    } else if (action.do === "close") {
      io.gh(["issue", "close", String(action.number), "--comment", action.body])
      io.out(`closed #${action.number}: main is green at ${sha}`)
    } else
      io.out(
        `kept #${action.number} open: ${sha} does not contain ${action.missing.join(", ")}`
      )
  }
  return actions
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  main(process.env, liveIo())
