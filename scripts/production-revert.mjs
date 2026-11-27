#!/usr/bin/env node
import { execFileSync } from "node:child_process"
import { mkdirSync, writeFileSync } from "node:fs"
import { homedir } from "node:os"
import { dirname, join } from "node:path"
import { parseArgs } from "node:util"
import { fileURLToPath, pathToFileURL } from "node:url"

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..")
export const MIGRATIONS = "apps/api/drizzle"
export const REVERT_LABEL = "production-red-revert"
export const MOST_MERGES = 20
const FULL_SHA = /^[0-9a-f]{40}$/

export function withoutGitVariables(env) {
  return Object.fromEntries(
    Object.entries(env).filter(([name]) => !name.startsWith("GIT_"))
  )
}

export function liveGit(cwd) {
  return (args) =>
    execFileSync("git", ["-C", cwd, ...args], {
      encoding: "utf8",
      timeout: 120_000,
      env: withoutGitVariables(process.env),
      stdio: ["ignore", "pipe", "pipe"],
    })
}

export function planRevert({ bad, good }, git) {
  if (!FULL_SHA.test(bad ?? ""))
    throw new Error("give the red commit as a full sha")
  if (!FULL_SHA.test(good ?? ""))
    throw new Error(
      "no last passing commit: give --good <full sha> or let the probe history name one"
    )
  try {
    git(["merge-base", "--is-ancestor", good, bad])
  } catch {
    throw new Error(
      `${good.slice(0, 8)} is not an ancestor of ${bad.slice(0, 8)} on this history`
    )
  }
  const commits = git([
    "log",
    "--first-parent",
    "--format=%H%x09%s",
    `${good}..${bad}`,
  ])
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const [sha, ...subject] = line.split("\t")
      return { sha, subject: subject.join("\t") }
    })
  if (commits.length === 0)
    throw new Error(
      `nothing to revert between ${good.slice(0, 8)} and ${bad.slice(0, 8)}`
    )
  if (commits.length > MOST_MERGES)
    throw new Error(
      `${commits.length} merges since the last pass; more than ${MOST_MERGES} needs a person to choose`
    )
  const migrations = git(["diff", "--name-only", good, bad, "--", MIGRATIONS])
    .split("\n")
    .filter(Boolean)
  return { bad, good, commits, migrations }
}

export function revertTitle(plan) {
  return `fix: production is red after ${plan.bad.slice(0, 8)}, revert ${plan.commits.length} merge${plan.commits.length === 1 ? "" : "s"}`
}

export function revertBody(plan) {
  return [
    `**Now:** Restore the code from ${plan.good}, the last commit that passed the deploy probe. This reverts every merge after it.`,
    `**Proof:** \`git merge-base --is-ancestor ${plan.good} ${plan.bad}\`: exit 0. The deploy probe failed twice on ${plan.bad}. The range contains ${plan.commits.length} merge(s) to revert.`,
    "",
    "Caught by: ci",
    "Introduced by: unknown",
    "",
    plan.migrations.length === 0
      ? "**Risk:** No migration in the reverted range. Merging deploys the code of the last passing commit."
      : `**Risk:** Merging restores the last passing code and keeps the production schema, including ${plan.migrations.join(", ")}.`,
    "",
    "<details><summary>Reverted merges</summary>",
    "",
    ...plan.commits.map(
      (commit) => `- ${commit.sha.slice(0, 8)} ${commit.subject}`
    ),
    "",
    "</details>",
    "",
  ].join("\n")
}

export function steps(plan) {
  return [
    `take "${revertTitle(plan)}" --risk normal -d "production red revert"`,
    ...plan.commits.map((commit) => `git revert --no-commit ${commit.sha}`),
    `git checkout HEAD -- ${MIGRATIONS}`,
    `save -m "${revertTitle(plan).replace(/^fix: /, "revert: ")}"`,
    "finish --body-file <revert body>",
    `gh pr edit <pr> --add-label ${REVERT_LABEL}`,
    "gh pr merge <pr> --auto --squash",
  ]
}

export function prepare(plan, ports) {
  const taken = ports.tools([
    "take",
    revertTitle(plan),
    "--what",
    `Production failed the deploy check twice after ${plan.bad.slice(0, 8)}. People may not be able to open their documents.`,
    "--done",
    "The merges after the last passing check are undone in code. Every database change stays. The deploy check passes again.",
    "--risk",
    "normal",
    "-d",
    "production red revert",
  ])
  const worktree = taken.match(/^Worktree: (.+)$/m)?.[1]?.trim()
  if (!worktree)
    throw new Error("take printed no worktree; nothing was changed")
  const git = ports.git(worktree)
  for (const commit of plan.commits) {
    try {
      git(["revert", "--no-commit", commit.sha])
    } catch {
      throw new Error(
        `reverting ${commit.sha.slice(0, 8)} conflicts; the worktree ${worktree} is left for a person, nothing was pushed`
      )
    }
  }
  git(["checkout", "HEAD", "--", MIGRATIONS])
  ports.tools(
    ["save", "-m", revertTitle(plan).replace(/^fix: /, "revert: ")],
    worktree
  )
  const bodyFile = ports.writeBody(revertBody(plan))
  const finished = ports.tools(["finish", "--body-file", bodyFile], worktree)
  const url = finished.match(/https:\/\/github\.com\/[^\s]+\/pull\/\d+/)?.[0]
  if (!url) throw new Error("finish printed no pull request link")
  ports.gh(["pr", "edit", url, "--add-label", REVERT_LABEL])
  ports.gh(["pr", "merge", url, "--auto", "--squash"])
  return { worktree, url }
}

export function liveHistory(gh) {
  return {
    lastPassed() {
      const runs = gh([
        "api",
        "repos/{owner}/{repo}/actions/workflows/nightly.yml/runs?branch=main&event=push&per_page=30",
        "--jq",
        ".workflow_runs[] | [.id, .head_sha] | @tsv",
      ])
      for (const line of runs.split("\n").filter(Boolean)) {
        const [id, sha] = line.split("\t")
        const conclusion = gh([
          "api",
          `repos/{owner}/{repo}/actions/runs/${id}/jobs`,
          "--jq",
          '.jobs[] | select(.name == "probe") | .conclusion',
        ]).trim()
        if (conclusion === "success") return sha
      }
      return null
    },
  }
}

export function main(argv, io) {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      good: { type: "string" },
      apply: { type: "boolean", default: false },
    },
  })
  const bad = positionals[0]
  const good = values.good ?? io.lastPassed()
  const plan = planRevert({ bad, good }, io.git)
  io.out(
    `${values.apply ? "Preparing" : "Would prepare"} one revert pull request: ${revertTitle(plan)}`
  )
  for (const commit of plan.commits)
    io.out(`  revert ${commit.sha.slice(0, 8)} ${commit.subject}`)
  io.out(
    plan.migrations.length === 0
      ? "  no migration in the range"
      : `  keep migrations: ${plan.migrations.join(", ")}`
  )
  if (!values.apply) {
    for (const line of steps(plan)) io.out(`  step: ${line}`)
    io.out(
      "Dry run: nothing was changed. Add --apply to open the pull request."
    )
    return { plan }
  }
  const prepared = prepare(plan, io.ports)
  io.out(`Opened ${prepared.url} with label ${REVERT_LABEL} and auto-merge on.`)
  return { plan, ...prepared }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const run = (command, args, cwd = repoRoot) =>
    execFileSync(command, args, {
      cwd,
      encoding: "utf8",
      timeout: command === "gh" ? 120_000 : 1_800_000,
      stdio: ["ignore", "pipe", "inherit"],
    })
  const gh = (args) => run("gh", args)
  try {
    main(process.argv.slice(2), {
      out: (line) => process.stdout.write(`${line}\n`),
      git: liveGit(repoRoot),
      lastPassed: () => liveHistory(gh).lastPassed(),
      ports: {
        tools: (args, cwd = repoRoot) =>
          run("node", [join(cwd, "scripts/ocv-tools.mjs"), ...args], cwd),
        git: liveGit,
        gh,
        writeBody(body) {
          const folder = join(homedir(), "tmp", "production-revert")
          mkdirSync(folder, { recursive: true })
          const file = join(folder, `body-${process.pid}.md`)
          writeFileSync(file, body)
          return file
        },
      },
    })
  } catch (error) {
    process.stderr.write(`REVERT NOT PREPARED ${error.message}\n`)
    process.exitCode = 1
  }
}
