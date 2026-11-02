import { join } from "node:path"
import { FAST_GUARDS, GIT_ENV } from "./push-checks.mjs"
import { run } from "./common.mjs"

const OID = /^[0-9a-f]{40,64}$/
const GUARD_TIMEOUT_SECONDS = "600"
const SHOWN = 8

export function parseMergeTree(result) {
  const lines = result.out.split("\n")
  if (!OID.test(lines[0] ?? "")) return { error: result.err || result.out }
  if (result.ok) return { tree: lines[0], conflicts: [] }
  const blank = lines.indexOf("", 1)
  const names = lines.slice(1, blank === -1 ? undefined : blank)
  return { tree: lines[0], conflicts: [...new Set(names)] }
}

export function failedGuards(result) {
  if (result.ok) return []
  const text = `${result.out}\n${result.err}`
  const names = [...text.matchAll(/^✖ (.+?) \(\d[\d.]*ms\)$/gm)].map(
    (m) => m[1]
  )
  const files = [...text.matchAll(/^FAIL (\S+)/gm)].map((m) => m[1])
  const found = [...new Set([...names, ...files])]
  if (found.length) return found
  return [
    `the guards exited without naming a test (${result.err || "no output"})`,
  ]
}

function git(ctx, args, options) {
  return run(ctx, "git", args, options)
}

export function fetchPull(ctx, n) {
  return git(ctx, ["fetch", "origin", "main", `refs/pull/${n}/head`]).ok
}

export function isBehind(ctx, head) {
  const r = git(ctx, ["rev-list", "--count", `${head}..origin/main`])
  return r.ok && Number(r.out) > 0
}

export function mergeTreeOf(ctx, head) {
  return parseMergeTree(
    git(ctx, [
      "merge-tree",
      "--write-tree",
      "--name-only",
      "--no-messages",
      "origin/main",
      head,
    ])
  )
}

export function conflictsOf(ctx, n, head) {
  if (!fetchPull(ctx, n)) return []
  const merged = mergeTreeOf(ctx, head)
  return merged.conflicts ?? []
}

function existing(ctx, commit, paths) {
  const r = git(ctx, ["ls-tree", "-r", "--name-only", commit, "--", ...paths])
  return r.ok ? r.out.split("\n").filter(Boolean) : []
}

function guardsFor(ctx, commit) {
  const touched = git(ctx, ["diff", "--name-only", "origin/main", commit])
  const tools = touched.out
    .split("\n")
    .some((file) => file.startsWith("scripts/ocv-tools/"))
  const listed = existing(ctx, commit, [
    ...FAST_GUARDS,
    ...(tools ? ["scripts/ocv-tools"] : []),
  ])
  return listed.filter(
    (file) => FAST_GUARDS.includes(file) || /\.test\.mjs$/.test(file)
  )
}

function linkInstalled(ctx, top, dir) {
  const workspaces = existing(ctx, "HEAD", ["apps", "packages"])
    .filter((file) => /^(?:apps|packages)\/[^/]+\/package\.json$/.test(file))
    .map((file) => file.replace(/\/package\.json$/, ""))
  for (const place of ["", ...workspaces]) {
    const from = join(top, place, "node_modules")
    if (!ctx.ports.fs.exists(from)) continue
    if (place) ctx.ports.fs.mkdir(join(dir, place))
    run(ctx, "ln", ["-s", from, join(dir, place, "node_modules")])
  }
}

function dependenciesDiffer(ctx, commit) {
  const mine = git(ctx, ["rev-parse", "HEAD:pnpm-lock.yaml"])
  const theirs = git(ctx, ["rev-parse", `${commit}:pnpm-lock.yaml`])
  return !mine.ok || !theirs.ok || mine.out !== theirs.out
}

export function removeTemporaryTree(ctx, dir) {
  git(ctx, ["worktree", "remove", "--force", dir])
  if (ctx.ports.fs.exists(dir)) run(ctx, "rm", ["-rf", dir])
  git(ctx, ["worktree", "prune"])
}

export function guardsOnMergedTree(ctx, n, head, tree) {
  const top = git(ctx, ["rev-parse", "--show-toplevel"]).out
  const commit = git(ctx, [
    "commit-tree",
    tree,
    "-p",
    "origin/main",
    "-p",
    head,
    "-m",
    `merge of PR #${n}`,
  ])
  if (!commit.ok)
    return { skipped: `could not build the merged commit: ${commit.err}` }
  if (dependenciesDiffer(ctx, commit.out))
    return {
      skipped:
        "the merge changes the lockfile, so installed packages do not match",
    }
  const home = ctx.env.HOME ?? "/tmp"
  const parent = join(home, "tmp")
  const dir = join(parent, `ocv-merge-${n}-${head.slice(0, 8)}`)
  ctx.ports.fs.mkdir(parent)
  removeTemporaryTree(ctx, dir)
  try {
    const added = git(ctx, ["worktree", "add", "--detach", dir, commit.out])
    if (!added.ok)
      return { skipped: `could not check out the merged tree: ${added.err}` }
    linkInstalled(ctx, top, dir)
    const files = guardsFor(ctx, commit.out)
    const result = run(
      ctx,
      "timeout",
      [
        GUARD_TIMEOUT_SECONDS,
        "env",
        ...[...GIT_ENV, "NODE_TEST_CONTEXT"].flatMap((name) => ["-u", name]),
        "node",
        "--test",
        "--test-concurrency=3",
        "--test-reporter=dot",
        ...files,
      ],
      { cwd: dir }
    )
    return {
      ran: files.length,
      failed: result.ok ? [] : failedGuards(result).slice(0, SHOWN),
    }
  } finally {
    removeTemporaryTree(ctx, dir)
  }
}

export function mergeResultFacts(ctx, n, head) {
  if (!fetchPull(ctx, n))
    return { n, head, lines: ["Merged-tree check skipped: git fetch failed."] }
  if (!isBehind(ctx, head)) return { n, head, lines: [], conflicts: [] }
  const merged = mergeTreeOf(ctx, head)
  if (merged.error)
    return {
      n,
      head,
      lines: [
        `Merged-tree check skipped: ${String(merged.error).split("\n")[0]}`,
      ],
    }
  if (merged.conflicts.length)
    return { n, head, lines: [], conflicts: merged.conflicts }
  const guards = guardsOnMergedTree(ctx, n, head, merged.tree)
  if (guards.skipped)
    return {
      n,
      head,
      lines: [`Merged-tree guards skipped: ${guards.skipped}.`],
      conflicts: [],
    }
  return {
    n,
    head,
    conflicts: [],
    failed: guards.failed,
    lines: [`Merged tree passes ${guards.ran} quick guards.`],
  }
}
