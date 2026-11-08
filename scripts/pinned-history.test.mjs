import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
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
    if (/^[0-9a-f]{4,40}$/.test(rev)) {
      const matches = git(["rev-parse", `--disambiguate=${rev}`], cwd)
        .split("\n")
        .filter(Boolean)
      if (matches.length !== 1) return null
      rev = matches[0]
    }
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
  if (resolve("origin/main", cwd)) return "origin/main"
  throw new Error("Cannot validate history without canonical origin/main")
}

function historyFiles(files) {
  return files.filter(
    (file) =>
      /\.(?:test|spec)\.[cm]?[jt]sx?$/.test(file) ||
      /(?:^|[/._-])(?:fixtures?|tests?|__tests__)(?:[/._-]|$)/.test(file) ||
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
  const retainedTips = tags.flatMap((tag) => {
    const token = tag.slice("guard-proof/".length)
    const tip = commit(`refs/tags/${tag}`)
    return /^[0-9a-f]{4,40}$/.test(token) && tip?.startsWith(token) ? [tip] : []
  })
  const retained = new Map()
  return {
    isCommit: (ref) => commit(ref) !== null,
    isOnMain: (ref) => {
      const sha = commit(ref)
      if (sha === null) return false
      if (!retained.has(sha))
        retained.set(
          sha,
          [main, ...retainedTips].some((tip) => isAncestor(sha, tip, cwd))
        )
      return retained.get(sha)
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

test("ignores every hex token that does not resolve to a commit", () => {
  for (const source of [
    'const accent = "deadbeef"',
    'const missing = "cafebabe1:path"',
    JSON.stringify({ historic: { sha: "abcdef0", fixed: { rev: "HEAD" } } }),
  ])
    assert.deepEqual(
      commitsMissingFromMain(
        source,
        () => false,
        () => false
      ),
      []
    )
})

test("ignores short numeric and UUID fragments before resolving candidates", () => {
  assert.deepEqual(
    commitsMissingFromMain(
      'const port = 7111; const fragment = "4b8e"; const short = "abcdef"',
      () => assert.fail("short tokens must not be resolved"),
      () => assert.fail("short tokens must not require retention")
    ),
    []
  )
})

test("resolves commit candidates without interpreting command syntax or fixture content", () => {
  const sources = [
    'execFileSync("git", ["show", "abc1234:src/a.ts"])',
    'const args = ["show", "abc1234:src/a.ts"]; execFileSync("git", args)',
    'execFileSync("git", ["--no-pager", "show", "abc1234:src/a.ts"])',
    'const revision = "abc1234"; readPayload(revision)',
    `const fixture = 'execFileSync("git", ["show", "abc1234:src/a.ts"])'`,
    'const hex = "abc1234"',
    JSON.stringify({ historic: { sha: "abc1234", fixed: { rev: "HEAD" } } }),
  ]
  for (const source of sources) {
    assert.deepEqual(
      commitsMissingFromMain(
        source,
        () => true,
        () => false
      ),
      ["abc1234"]
    )
    assert.deepEqual(
      commitsMissingFromMain(
        source,
        () => true,
        () => true
      ),
      []
    )
  }
  assert.deepEqual(
    commitsMissingFromMain(
      '"abcdef0" "abc1234" "abcdef0"',
      () => true,
      () => false
    ),
    ["abcdef0", "abc1234"]
  )
})

test("history discovery includes ledger rows and tests outside scripts", () => {
  assert.deepEqual(
    historyFiles([
      "scripts/guard-ledger/mcp-harness.json",
      "apps/api/src/history.test.ts",
      "apps/web/src/history.spec.tsx",
      "packages/domain/history.test.mjs",
      "scripts/fixtures/history/input.json",
      "apps/api/src/auth.fixtures.ts",
      "apps/web/src/test/history-helper.ts",
      "scripts/other.json",
      "apps/api/src/history.ts",
    ]),
    [
      "scripts/guard-ledger/mcp-harness.json",
      "apps/api/src/history.test.ts",
      "apps/web/src/history.spec.tsx",
      "packages/domain/history.test.mjs",
      "scripts/fixtures/history/input.json",
      "apps/api/src/auth.fixtures.ts",
      "apps/web/src/test/history-helper.ts",
    ]
  )
})

test("PR-only history fails while the object exists, and only a correctly targeted proof tag retains it", () => {
  withTempDir("pinned-history-", (cwd) => {
    git(["init", "-b", "main"], cwd)
    git(["commit", "--allow-empty", "-m", "base"], cwd)
    const base = git(["rev-parse", "HEAD"], cwd)
    git(["update-ref", "refs/remotes/origin/main", base], cwd)
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
    assert.equal(mainRef(cwd), "origin/main")
    assert.deepEqual(missing(), [draft])
    const initial = historyChecks(cwd)
    assert.equal(initial.isCommit(draft.slice(0, 4)), true)
    assert.equal(initial.isOnMain(draft.slice(0, 4)), false)
    git(["tag", `guard-proof/${draft}`, base], cwd)
    assert.deepEqual(missing(), [draft])
    git(["tag", `guard-proof/${draft.slice(0, 8)}`, draft], cwd)
    assert.deepEqual(missing(), [])
    git(["commit", "--allow-empty", "-m", "retained descendant"], cwd)
    const descendant = git(["rev-parse", "HEAD"], cwd)
    git(["tag", `guard-proof/${descendant}`, descendant], cwd)
    git(["tag", "-d", `guard-proof/${draft.slice(0, 8)}`], cwd)
    assert.deepEqual(missing(), [])
    const checks = historyChecks(cwd)
    assert.equal(checks.isOnMain(base), true)
    git(["update-ref", "-d", "refs/remotes/origin/main"], cwd)
    assert.throws(() => historyChecks(cwd), /canonical origin\/main/)
  })
})

test("the PR guard rejects aliased and option-prefixed reads before squash loses their commit", () => {
  withTempDir("pinned-history-squash-", (cwd) => {
    const repo = `${cwd}/repo`
    const clone = `${cwd}/clone`
    mkdirSync(`${repo}/scripts/lib`, { recursive: true })
    git(["init", "-b", "main"], repo)
    writeFileSync(`${repo}/payload.txt`, "base\n")
    git(["add", "payload.txt"], repo)
    git(["commit", "-m", "base fixture"], repo)
    const base = git(["rev-parse", "HEAD"], repo)
    git(["update-ref", "refs/remotes/origin/main", base], repo)
    git(["switch", "-c", "draft"], repo)
    writeFileSync(`${repo}/payload.txt`, "draft\n")
    git(["commit", "-am", "branch payload fixture"], repo)
    const draft = git(["rev-parse", "HEAD"], repo)
    for (const file of [
      "scripts/pinned-history.test.mjs",
      "scripts/lib/pinned-history.mjs",
      "scripts/lib/temp-dir.mjs",
    ])
      writeFileSync(`${repo}/${file}`, readFileSync(new URL(file, root)))
    const variants = [
      `const args = ["show", "${draft}:payload.txt"]; const read = () => execFileSync("git", args)`,
      `const read = () => execFileSync("git", ["--no-pager", "show", "${draft}:payload.txt"])`,
    ]
    const env = { ...process.env }
    delete env.NODE_TEST_CONTEXT
    const guard = (directory) => {
      try {
        return {
          status: 0,
          output: execFileSync(
            process.execPath,
            [
              "--test",
              "--test-name-pattern=^every ledger",
              "scripts/pinned-history.test.mjs",
            ],
            {
              cwd: directory,
              env,
              encoding: "utf8",
              stdio: ["ignore", "pipe", "pipe"],
            }
          ),
        }
      } catch (error) {
        return { status: error.status, output: String(error.stdout) }
      }
    }
    for (const variant of variants) {
      writeFileSync(
        `${repo}/scripts/payload.test.mjs`,
        `import { execFileSync } from "node:child_process"; ${variant}; if (read().toString().trim() !== "draft") throw new Error("wrong payload")`
      )
      git(["add", "scripts"], repo)
      const result = guard(repo)
      assert.equal(result.status, 1, result.output)
      assert.ok(result.output.includes(draft), result.output)
      execFileSync(process.execPath, ["scripts/payload.test.mjs"], {
        cwd: repo,
      })
    }
    git(["commit", "-m", "history reader fixture"], repo)
    git(["switch", "main"], repo)
    git(["merge", "--squash", "draft"], repo)
    git(["commit", "-m", "squashed fixture"], repo)
    git(
      [
        "clone",
        "--no-local",
        "--single-branch",
        "--branch",
        "main",
        repo,
        clone,
      ],
      cwd
    )
    assert.equal(resolve(draft, clone), null)
    assert.throws(() =>
      execFileSync(process.execPath, ["scripts/payload.test.mjs"], {
        cwd: clone,
        stdio: "pipe",
      })
    )
    assert.equal(guard(clone).status, 0)
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
