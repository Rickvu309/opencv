import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"
import { withTempDir } from "./lib/temp-dir.mjs"
import { test } from "node:test"
import { commitsMissingFromMain } from "./lib/pinned-history.mjs"

const root = new URL("../", import.meta.url)

function git(args, cwd = root) {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim()
}

function resolve(rev, cwd = root) {
  try {
    return git(["rev-parse", "--verify", `${rev}^{commit}`], cwd)
  } catch {
    return null
  }
}

function isAncestor(commit, main, cwd = root) {
  try {
    git(["merge-base", "--is-ancestor", commit, main], cwd)
    return true
  } catch {
    return false
  }
}

function mainRef(cwd = root) {
  for (const ref of ["origin/main", "refs/heads/main"])
    if (resolve(ref, cwd)) return ref
  throw new Error("Cannot validate history without canonical main")
}

function historyFiles(files) {
  return files.filter(
    (file) =>
      /\.(?:test|spec)\.[cm]?[jt]sx?$/.test(file) ||
      /^scripts\/guard-ledger\/[^/]+\.json$/.test(file)
  )
}

function historyChecks(cwd = root) {
  const main = mainRef(cwd)
  const tags = git(["tag", "--list", "guard-proof/*"], cwd)
    .split("\n")
    .filter(Boolean)
  const commits = new Map()
  const commit = (ref) => {
    if (!commits.has(ref)) commits.set(ref, resolve(ref, cwd))
    return commits.get(ref)
  }
  return {
    isCommit: (ref) => commit(ref) !== null,
    isOnMain: (ref) => {
      const sha = commit(ref)
      if (!sha) return false
      if (isAncestor(sha, main, cwd)) return true
      return tags.some((tag) => {
        const token = tag.slice("guard-proof/".length)
        return (
          /^[0-9a-f]{7,40}$/.test(token) &&
          sha.startsWith(token) &&
          commit(`refs/tags/${tag}`) === sha
        )
      })
    },
  }
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

test("ledger history must resolve and survive squash, including fixed sources", () => {
  const file = "scripts/guard-ledger/example.json"
  const mistake = JSON.stringify({
    historic: {
      mode: "detect",
      sha: "abc1234",
      fixed: { rev: "def5678" },
    },
  })
  const clean = JSON.stringify({
    historic: {
      mode: "detect",
      sha: "def5678",
      fixed: { rev: "HEAD" },
    },
  })
  const isCommit = (sha) => sha === "def5678"
  const retained = (sha) => sha === "def5678"
  assert.deepEqual(commitsMissingFromMain(mistake, isCommit, retained, file), [
    "abc1234",
  ])
  assert.deepEqual(
    commitsMissingFromMain(mistake, () => true, retained, file),
    ["abc1234"]
  )
  assert.deepEqual(commitsMissingFromMain(clean, isCommit, retained, file), [])
  assert.deepEqual(
    commitsMissingFromMain(
      JSON.stringify({ historic: { mode: "revert", fix: "abc1234" } }),
      () => true,
      retained,
      file
    ),
    ["abc1234"]
  )
})

test("a missing literal test reference fails closed while fixture strings are not history reads", () => {
  const direct = 'execFileSync("git", ["show", "abc1234:src/a.ts"])'
  const indirect =
    'const revision = "abc1234"; git(["show", `${revision}:src/a.ts`])'
  const fixture = `const example = 'execFileSync("git", ["show", "abc1234:src/a.ts"])'`
  for (const source of [direct, indirect])
    assert.deepEqual(
      commitsMissingFromMain(
        source,
        () => false,
        () => false
      ),
      ["abc1234"]
    )
  assert.deepEqual(
    commitsMissingFromMain(
      fixture,
      () => true,
      () => false
    ),
    []
  )
})

test("history discovery includes ledger rows and tests outside scripts", () => {
  assert.deepEqual(
    historyFiles([
      "scripts/guard-ledger/mcp-harness.json",
      "apps/api/src/history.test.ts",
      "apps/web/src/history.spec.tsx",
      "packages/domain/history.test.mjs",
      "scripts/other.json",
      "apps/api/src/history.ts",
    ]),
    [
      "scripts/guard-ledger/mcp-harness.json",
      "apps/api/src/history.test.ts",
      "apps/web/src/history.spec.tsx",
      "packages/domain/history.test.mjs",
    ]
  )
})

test("PR-only history fails while the object exists, and only a correctly targeted proof tag retains it", () => {
  withTempDir("pinned-history-", (cwd) => {
    git(["init", "-b", "main"], cwd)
    git(["commit", "--allow-empty", "-m", "base"], cwd)
    const base = git(["rev-parse", "HEAD"], cwd)
    git(["switch", "-c", "draft"], cwd)
    git(["commit", "--allow-empty", "-m", "draft"], cwd)
    const draft = git(["rev-parse", "HEAD"], cwd)
    const file = "scripts/guard-ledger/example.json"
    const source = JSON.stringify({ historic: { mode: "detect", sha: draft } })
    const missing = () => {
      const checks = historyChecks(cwd)
      return commitsMissingFromMain(
        source,
        checks.isCommit,
        checks.isOnMain,
        file
      )
    }
    assert.equal(mainRef(cwd), "refs/heads/main")
    assert.deepEqual(missing(), [draft])
    git(["tag", `guard-proof/${draft}`, base], cwd)
    assert.deepEqual(missing(), [draft])
    git(["tag", `guard-proof/${draft.slice(0, 8)}`, draft], cwd)
    assert.deepEqual(missing(), [])
    const checks = historyChecks(cwd)
    assert.equal(checks.isOnMain(base), true)
    git(["branch", "-m", "main", "unrelated"], cwd)
    assert.throws(() => historyChecks(cwd), /canonical main/)
  })
})

test("every ledger or test history reference is on main or retained by a matching guard-proof tag", () => {
  const checks = historyChecks()
  const files = historyFiles(git(["ls-files"]).split("\n"))
  const missing = files.flatMap((file) =>
    commitsMissingFromMain(
      readFileSync(new URL(file, root), "utf8"),
      checks.isCommit,
      checks.isOnMain,
      file
    ).map((commit) => `${file}: ${commit}`)
  )
  assert.deepEqual(
    missing,
    [],
    "history would be lost after squash; use main ancestry or publish a correctly targeted guard-proof/<commit> tag"
  )
})
