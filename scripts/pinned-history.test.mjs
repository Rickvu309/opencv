import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { readdirSync, readFileSync } from "node:fs"
import { test } from "node:test"
import { commitsMissingFromMain } from "./lib/pinned-history.mjs"

const root = new URL("../", import.meta.url)

function git(args) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim()
}

function succeeds(args) {
  try {
    git(args)
    return true
  } catch {
    return false
  }
}

function mainRef() {
  if (succeeds(["rev-parse", "--verify", "--quiet", "origin/main"]))
    return "origin/main"
  return "HEAD"
}

function testFiles(directory) {
  return readdirSync(new URL(directory, root), { withFileTypes: true }).flatMap(
    (entry) => {
      const relative = `${directory}${entry.name}`
      if (entry.isDirectory())
        return entry.name === "node_modules" ? [] : testFiles(`${relative}/`)
      return entry.name.endsWith(".test.mjs") ? [relative] : []
    }
  )
}

test("flags a pinned commit that only lives on a branch", () => {
  const mistake = 'execFileSync("git", ["show", `abc1234:${path}`])'
  const clean = 'execFileSync("git", ["show", `def5678:${path}`])'
  const isCommit = () => true
  const isOnMain = (commit) => commit === "def5678"
  assert.deepEqual(commitsMissingFromMain(mistake, isCommit, isOnMain), [
    "abc1234",
  ])
  assert.deepEqual(commitsMissingFromMain(clean, isCommit, isOnMain), [])
})

test("ignores hex text that is not a commit and files that never read history", () => {
  const colours = 'const accent = "deadbeef"'
  assert.deepEqual(
    commitsMissingFromMain(
      colours,
      () => true,
      () => false
    ),
    []
  )
  const notCommit = 'git show "cafebabe1:path"'.replace("git show", '["show"')
  assert.deepEqual(
    commitsMissingFromMain(
      notCommit,
      () => false,
      () => false
    ),
    []
  )
})

test("every commit a test reads from history is on main or kept by a guard-proof tag", () => {
  const main = mainRef()
  const isCommit = (candidate) =>
    succeeds(["cat-file", "-e", `${candidate}^{commit}`])
  const isOnMain = (candidate) =>
    succeeds(["merge-base", "--is-ancestor", candidate, main]) ||
    succeeds([
      "rev-parse",
      "--verify",
      "--quiet",
      `refs/tags/guard-proof/${candidate}`,
    ])
  const missing = testFiles("scripts/").flatMap((file) =>
    commitsMissingFromMain(
      readFileSync(new URL(file, root), "utf8"),
      isCommit,
      isOnMain
    ).map((commit) => `${file}: ${commit}`)
  )
  assert.deepEqual(
    missing,
    [],
    "tests read commits that a squash merge removes; pin a commit on main or push a guard-proof/<commit> tag for it"
  )
})
