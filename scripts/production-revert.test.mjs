import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"
import { test } from "node:test"

import { tempDir } from "./lib/temp-dir.mjs"

import {
  MIGRATIONS,
  MOST_MERGES,
  REVERT_LABEL,
  liveGit,
  main,
  planRevert,
  prepare,
  revertBody,
  withoutGitVariables,
} from "./production-revert.mjs"

const scratchRoot = join(homedir(), "tmp", "opencv-rollout", "tool-scratch")

function history(commits) {
  const stream = []
  commits.forEach((commit, index) => {
    stream.push("commit refs/heads/main", `mark :${index + 1}`)
    stream.push(
      `committer Fixture <fixture@example.invalid> ${1700000000 + index * 60} +0000`
    )
    stream.push(`data ${Buffer.byteLength(commit.subject)}`, commit.subject)
    if (index > 0) stream.push(`from :${index}`)
    for (const [path, content] of Object.entries(commit.files)) {
      if (content === null) stream.push(`D ${path}`)
      else
        stream.push(
          `M 100644 inline ${path}`,
          `data ${Buffer.byteLength(content)}`,
          content
        )
    }
  })
  return `${stream.join("\n")}\n`
}

function repository(t, commits) {
  const folder = tempDir(t, "revert-", scratchRoot)
  const env = withoutGitVariables(process.env)
  execFileSync("git", ["init", "-q", "-b", "main", folder], { env })
  execFileSync("git", ["-C", folder, "fast-import", "--quiet"], {
    env,
    input: history(commits),
  })
  execFileSync("git", ["-C", folder, "checkout", "-q", "main"], { env })
  const git = liveGit(folder)
  const shas = git(["log", "--format=%H", "--reverse", "main"])
    .split("\n")
    .filter(Boolean)
  return { folder, git, shas }
}

const journal = (...tags) =>
  JSON.stringify({ entries: tags.map((tag, idx) => ({ idx, tag })) })

const incident = [
  {
    subject: "feat: last passing (#10)",
    files: {
      "apps/api/src/page.ts": "v1\n",
      [`${MIGRATIONS}/0000_a.sql`]: "create table a();\n",
      [`${MIGRATIONS}/meta/_journal.json`]: journal("0000_a"),
    },
  },
  {
    subject: "feat: adds a column (#11)",
    files: {
      "apps/api/src/page.ts": "v2\n",
      [`${MIGRATIONS}/0001_b.sql`]: "alter table a add b int;\n",
      [`${MIGRATIONS}/meta/_journal.json`]: journal("0000_a", "0001_b"),
    },
  },
  {
    subject: "fix: breaks the page (#12)",
    files: { "apps/web/src/page.tsx": "broken\n" },
  },
]

test("the range is every merge after the last passing commit, newest first", (t) => {
  const { git, shas } = repository(t, incident)
  const plan = planRevert({ bad: shas[2], good: shas[0] }, git)
  assert.deepEqual(plan.commits, [
    { sha: shas[2], subject: "fix: breaks the page (#12)" },
    { sha: shas[1], subject: "feat: adds a column (#11)" },
  ])
  assert.deepEqual(plan.migrations, [
    `${MIGRATIONS}/0001_b.sql`,
    `${MIGRATIONS}/meta/_journal.json`,
  ])
})

test("refuses a bad request before changing anything", (t) => {
  const { git, shas } = repository(t, incident)
  assert.throws(
    () => planRevert({ bad: "abc", good: shas[0] }, git),
    /full sha/
  )
  assert.throws(
    () => planRevert({ bad: shas[2], good: null }, git),
    /no last passing commit/
  )
  assert.throws(
    () => planRevert({ bad: shas[0], good: shas[2] }, git),
    /not an ancestor/
  )
  assert.throws(
    () => planRevert({ bad: shas[1], good: shas[1] }, git),
    /nothing to revert/
  )
  const long = repository(
    t,
    Array.from({ length: MOST_MERGES + 2 }, (_, index) => ({
      subject: `feat: ${index}`,
      files: { "f.txt": `${index}\n` },
    }))
  )
  assert.throws(
    () => planRevert({ bad: long.shas.at(-1), good: long.shas[0] }, long.git),
    /needs a person to choose/
  )
})

function fakePorts(folder, shapes = {}) {
  const calls = []
  const staged = {}
  return {
    calls,
    staged,
    ports: {
      tools(args, cwd) {
        calls.push(`tools ${args[0]}${cwd ? " in worktree" : ""}`)
        if (args[0] === "take")
          return `Took #99 ${args[1]}\nWorktree: ${folder}\nBranch: fix/99-x\n`
        if (args[0] === "save") {
          const git = liveGit(folder)
          staged.status = git(["status", "--porcelain"])
            .split("\n")
            .filter(Boolean)
            .sort()
          staged.page = readFileSync(
            join(folder, "apps/api/src/page.ts"),
            "utf8"
          )
          staged.migration = existsSync(
            join(folder, `${MIGRATIONS}/0001_b.sql`)
          )
          staged.journal = JSON.parse(
            readFileSync(
              join(folder, `${MIGRATIONS}/meta/_journal.json`),
              "utf8"
            )
          )
          staged.web = existsSync(join(folder, "apps/web/src/page.tsx"))
          return "Saved"
        }
        if (args[0] === "finish")
          return (
            shapes.finish ??
            "Opened https://github.com/Rickvu309/opencv/pull/1500\n"
          )
        throw new Error(`unexpected ${args[0]}`)
      },
      git: liveGit,
      gh(args) {
        calls.push(
          `gh ${args.slice(0, 2).join(" ")} ${args.slice(3).join(" ")}`
        )
        return ""
      },
      writeBody(body) {
        staged.body = body
        return "body.md"
      },
    },
  }
}

test("prepare reverts the code, keeps every migration file, and sets the label and auto-merge", (t) => {
  const { folder, git, shas } = repository(t, incident)
  const plan = planRevert({ bad: shas[2], good: shas[0] }, git)
  const fake = fakePorts(folder)
  const prepared = prepare(plan, fake.ports)
  assert.equal(prepared.url, "https://github.com/Rickvu309/opencv/pull/1500")
  assert.equal(fake.staged.page, "v1\n")
  assert.equal(fake.staged.web, false)
  assert.equal(fake.staged.migration, true)
  assert.deepEqual(
    fake.staged.journal.entries.map((entry) => entry.tag),
    ["0000_a", "0001_b"]
  )
  assert.deepEqual(fake.staged.status, [
    "D  apps/web/src/page.tsx",
    "M  apps/api/src/page.ts",
  ])
  assert.deepEqual(fake.calls, [
    "tools take",
    "tools save in worktree",
    "tools finish in worktree",
    `gh pr edit --add-label ${REVERT_LABEL}`,
    "gh pr merge --auto --squash",
  ])
  assert.match(
    fake.staged.body,
    /^\*\*Risk:\*\* .*keeps the production schema, including apps\/api\/drizzle\/0001_b\.sql(?=[,.])/m
  )
  assert.equal(git(["rev-parse", "main"]).trim(), shas[2])
})

test("a conflicting revert stops before save, leaving nothing pushed", (t) => {
  const { folder, git, shas } = repository(t, [
    ...incident,
    {
      subject: "feat: edits the same line (#13)",
      files: { "apps/api/src/page.ts": "v3\n" },
    },
  ])
  const plan = planRevert({ bad: shas[3], good: shas[0] }, git)
  const conflicting = {
    ...plan,
    commits: plan.commits.filter((commit) => commit.sha !== shas[3]),
  }
  const fake = fakePorts(folder)
  assert.throws(
    () => prepare(conflicting, fake.ports),
    /conflicts; the worktree .* is left for a person, nothing was pushed/
  )
  assert.deepEqual(fake.calls, ["tools take"])
})

test("a finish that opens no pull request stops before any label or auto-merge", (t) => {
  const { folder, git, shas } = repository(t, incident)
  const fake = fakePorts(folder, { finish: "refused: body problems" })
  assert.throws(
    () => prepare(planRevert({ bad: shas[2], good: shas[0] }, git), fake.ports),
    /no pull request link/
  )
  assert.ok(!fake.calls.some((call) => call.startsWith("gh")))
})

test("the dry run prints the range, the kept migrations and the steps, and changes nothing", (t) => {
  const { git, shas } = repository(t, incident)
  const out = []
  const result = main([shas[2], "--good", shas[0]], {
    out: (line) => out.push(line),
    git,
    lastPassed: () => assert.fail("--good was given"),
    ports: new Proxy({}, { get: () => assert.fail("dry run touches no port") }),
  })
  assert.equal(result.plan.commits.length, 2)
  assert.match(
    out[0],
    /^Would prepare one revert pull request: fix: production is red after [0-9a-f]{8}, revert 2 merges$/
  )
  assert.ok(
    out.includes(
      `  keep migrations: ${MIGRATIONS}/0001_b.sql, ${MIGRATIONS}/meta/_journal.json`
    )
  )
  assert.ok(out.includes(`  step: git checkout HEAD -- ${MIGRATIONS}`))
  assert.ok(out.includes("  step: gh pr merge <pr> --auto --squash"))
  assert.ok(
    !out.some((line) => /push.*main|--force|--no-verify/.test(line)),
    out.join("\n")
  )
  assert.equal(
    out.at(-1),
    "Dry run: nothing was changed. Add --apply to open the pull request."
  )
  assert.equal(git(["status", "--porcelain"]), "")
})

test("the last passing commit comes from the probe history when --good is absent", (t) => {
  const { git, shas } = repository(t, incident)
  const result = main([shas[2]], {
    out: () => {},
    git,
    lastPassed: () => shas[1],
    ports: {},
  })
  assert.deepEqual(
    result.plan.commits.map((commit) => commit.sha),
    [shas[2]]
  )
  assert.deepEqual(result.plan.migrations, [])
})

test("the body states code only and no migration when the range has none", () => {
  const body = revertBody({
    bad: "b".repeat(40),
    good: "a".repeat(40),
    commits: [{ sha: "c".repeat(40), subject: "fix: x (#1)" }],
    migrations: [],
  })
  assert.match(body, /^\*\*Now:\*\* Restore the code/)
  assert.match(body, /\*\*Proof:\*\* `git merge-base --is-ancestor .* exit 0/)
  assert.match(body, /\*\*Risk:\*\* No migration in the reverted range/)
  assert.match(
    body,
    /<details><summary>Reverted merges<\/summary>[\s\S]*fix: x \(#1\)/
  )
})

test("git runs without inherited git variables, so a hook cannot point it at this repository", () => {
  assert.deepEqual(
    withoutGitVariables({ GIT_DIR: "/x", GIT_INDEX_FILE: "/y", HOME: "/h" }),
    { HOME: "/h" }
  )
})
