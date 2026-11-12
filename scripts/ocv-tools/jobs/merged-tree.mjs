import { homedir } from "node:os"
import { join } from "node:path"
import { FAST_GUARDS } from "./push-checks.mjs"
import { run } from "./common.mjs"

const OID = /^[0-9a-f]{40,64}$/
const GUARD_TIMEOUT_SECONDS = "600"
const SHOWN = 8
const LEFTOVER_PREFIX = "ocv-merge-"
const STALE_AFTER_MS = (2 * Number(GUARD_TIMEOUT_SECONDS) + 60) * 1000
const SIGNAL_NUMBERS = { SIGINT: 2, SIGTERM: 15 }

export function parseMergeTree(result) {
  const lines = result.out.split("\n")
  if (!OID.test(lines[0] ?? ""))
    return { error: result.err || result.out || "no output" }
  if (result.ok) return { tree: lines[0], conflicts: [] }
  const blank = lines.indexOf("", 1)
  const names = lines.slice(1, blank === -1 ? undefined : blank)
  if (!names.some(Boolean)) return { error: result.err || result.out }
  return { tree: lines[0], conflicts: [...new Set(names)] }
}

export function failedGuards(result) {
  if (result.ok) return []
  const text = `${result.out}\n${result.err}`.replace(/\u001b\[[0-9;]*m/g, "")
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
  return r.ok ? Number(r.out) > 0 : null
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

function linkInstalled(ctx, top, dir, commit) {
  const workspaces = existing(ctx, commit, ["apps", "packages"])
    .filter((file) => /^(?:apps|packages)\/[^/]+\/package\.json$/.test(file))
    .map((file) => file.replace(/\/package\.json$/, ""))
  for (const place of ["", ...workspaces]) {
    const from = join(top, place, "node_modules")
    if (!ctx.ports.fs.exists(from)) continue
    if (place) ctx.ports.fs.mkdir(join(dir, place))
    run(ctx, "ln", ["-s", from, join(dir, place, "node_modules")])
  }
}

function installedMatches(ctx, commit) {
  const mine = git(ctx, ["rev-parse", "HEAD:pnpm-lock.yaml"])
  const theirs = git(ctx, ["rev-parse", `${commit}:pnpm-lock.yaml`])
  return mine.ok && theirs.ok && mine.out === theirs.out
}

function prepareDependencies(ctx, top, dir, commit) {
  if (installedMatches(ctx, commit)) {
    linkInstalled(ctx, top, dir, commit)
    return []
  }
  const installed = run(
    ctx,
    "timeout",
    [GUARD_TIMEOUT_SECONDS, "pnpm", "install", "--frozen-lockfile"],
    { cwd: dir }
  )
  if (installed.ok) return []
  const reason = `${installed.err}\n${installed.out}`.trim().split("\n")[0]
  return [
    `the merged tree could not install its locked packages (${reason || "no output"})`,
  ]
}

export function removeTemporaryTree(ctx, dir) {
  git(ctx, ["worktree", "remove", "--force", dir])
  if (ctx.ports.fs.exists(dir)) run(ctx, "rm", ["-rf", dir])
  git(ctx, ["worktree", "prune"])
}

function registeredTrees(ctx) {
  const listed = git(ctx, ["worktree", "list", "--porcelain"])
  return listed.out
    .split("\n")
    .filter((line) => line.startsWith("worktree "))
    .map((line) => line.slice("worktree ".length))
}

function ageMs(ctx, dir) {
  const stamp = run(ctx, "stat", ["-c", "%Y", dir])
  return stamp.ok ? ctx.now() - Number(stamp.out) * 1000 : Infinity
}

export function sweepLeftovers(ctx, parent) {
  const prefix = join(parent, LEFTOVER_PREFIX)
  const onDisk = ctx.ports.fs.list(parent).map((name) => join(parent, name))
  const found = new Set(
    [...registeredTrees(ctx), ...onDisk].filter((path) =>
      path.startsWith(prefix)
    )
  )
  const swept = []
  for (const dir of found) {
    if (ageMs(ctx, dir) < STALE_AFTER_MS) continue
    removeTemporaryTree(ctx, dir)
    swept.push(dir)
  }
  return swept
}

function removeOnSignal(ctx, dir) {
  const host = ctx.host ?? process
  const handlers = Object.entries(SIGNAL_NUMBERS).map(([signal, number]) => {
    const handler = () => {
      removeTemporaryTree(ctx, dir)
      host.exit(128 + number)
    }
    host.on(signal, handler)
    return [signal, handler]
  })
  return () => {
    for (const [signal, handler] of handlers) host.off(signal, handler)
  }
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
    return {
      ran: 0,
      swept: 0,
      failed: [`could not build the merged commit (${commit.err})`],
    }
  const parent = join(ctx.env.HOME ?? homedir(), "tmp")
  const dir = join(parent, `${LEFTOVER_PREFIX}${n}-${head.slice(0, 8)}`)
  ctx.ports.fs.mkdir(parent)
  const swept = sweepLeftovers(ctx, parent)
  removeTemporaryTree(ctx, dir)
  const release = removeOnSignal(ctx, dir)
  try {
    const added = git(ctx, ["worktree", "add", "--detach", dir, commit.out])
    if (!added.ok)
      return {
        ran: 0,
        swept: swept.length,
        failed: [`could not check out the merged tree (${added.err})`],
      }
    const unprepared = prepareDependencies(ctx, top, dir, commit.out)
    if (unprepared.length)
      return { ran: 0, swept: swept.length, failed: unprepared }
    const files = guardsFor(ctx, commit.out)
    const result = run(
      ctx,
      "timeout",
      [
        GUARD_TIMEOUT_SECONDS,
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
      swept: swept.length,
      failed: result.ok ? [] : failedGuards(result).slice(0, SHOWN),
    }
  } finally {
    release()
    removeTemporaryTree(ctx, dir)
  }
}

export function mergeResultFacts(ctx, n, head) {
  if (!fetchPull(ctx, n))
    return { n, head, lines: [], failed: ["git fetch failed"] }
  const behind = isBehind(ctx, head)
  if (behind === null)
    return {
      n,
      head,
      lines: [],
      failed: ["git rev-list failed"],
    }
  if (!behind) return { n, head, lines: [], conflicts: [] }
  const merged = mergeTreeOf(ctx, head)
  if (merged.error)
    return {
      n,
      head,
      lines: [],
      failed: [`git merge-tree failed: ${String(merged.error).split("\n")[0]}`],
    }
  if (merged.conflicts.length)
    return { n, head, lines: [], conflicts: merged.conflicts }
  const guards = guardsOnMergedTree(ctx, n, head, merged.tree)
  return {
    n,
    head,
    conflicts: [],
    failed: guards.failed,
    lines: [
      ...(guards.swept
        ? [`Removed ${guards.swept} leftover merged-tree worktrees.`]
        : []),
      ...(guards.failed.length
        ? []
        : [`Merged tree passes ${guards.ran} quick guards.`]),
    ],
  }
}
