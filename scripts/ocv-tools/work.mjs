// save and cleanup: keep work safe while holding an issue, and remove the workspace after the merge.
import { rmdirSync } from "node:fs"
import { EXIT, FIXES, Refused, gh } from "./core.mjs"
import { holderOf } from "./claim-marker.mjs"
import { agentIdFor, git, heartbeat, nowOf, taskHere } from "./claim.mjs"
import { loadIssue } from "./report.mjs"
import { locate } from "./worktree.mjs"

const withIssueSuffix = (message, n) =>
  /\(#\d+\)\s*$/.test(message) ? message : `${message} (#${n})`

// Another agent holds the claim: keep our work as a patch and stop.
function lost(ctx, { n }, holder) {
  git(ctx, "add", "-A")
  const base = git(ctx, "diff", "--cached", "--binary", "origin/main")
  const diff = base.ok ? base : git(ctx, "diff", "--cached", "--binary", "HEAD")
  const stamp = new Date(nowOf(ctx)).toISOString().replace(/[:.]/g, "-")
  const path = ctx.writeScratch(`lost/${n}-${stamp}.patch`, `${diff.out}\n`)
  return {
    exit: EXIT.LOST,
    lines: [
      `LOST #${n}: ${holder.agent ? `${holder.agent} holds the claim now` : "you no longer hold the claim"}.`,
      `Your work is saved as a patch: ${path}`,
      "Stop working on this issue.",
    ],
    fix: FIXES.LOST,
  }
}

export function save(ctx, { message }) {
  const t = taskHere(ctx)
  if (!message) throw new Error("usage: ocv-tools save -m <message>")
  const me = agentIdFor(ctx, t.gitDir)
  const { issue } = loadIssue(ctx, t.n)
  const h = holderOf(issue.comments.nodes, nowOf(ctx))
  if (!me || h.state === "none" || h.state === "released" || h.agent !== me)
    return lost(ctx, t, h)

  const dirty = git(ctx, "status", "--porcelain").out
  const upstream = git(ctx, "rev-parse", "--verify", `origin/${t.branch}`)
  const ahead = git(
    ctx,
    "rev-list",
    "--count",
    `${upstream.ok ? `origin/${t.branch}` : "origin/main"}..HEAD`
  ).out
  if (!dirty && !Number(ahead)) {
    heartbeat(ctx, t.n, h, me)
    return {
      lines: [
        `Nothing to save in #${t.n}: no changes and nothing waiting to upload. The claim is refreshed.`,
      ],
      next: "Keep working, or run scripts/open-pr.sh --draft when it is done",
    }
  }
  if (dirty) {
    const add = git(ctx, "add", "-A")
    const commit = add.ok
      ? git(ctx, "commit", "-m", withIssueSuffix(message, t.n))
      : add
    if (!commit.ok)
      throw new Error(
        `commit failed: ${commit.err || commit.out}`.slice(0, 800)
      )
  }
  const pushed = git(ctx, "push", "-u", "origin", "HEAD")
  if (!pushed.ok)
    throw new Error(
      `push failed (the pre-push check may have found a problem; your commit is safe locally): ${pushed.err || pushed.out}`.slice(
        -800
      )
    )
  heartbeat(ctx, t.n, h, me)
  return {
    lines: [
      `Saved #${t.n} on ${t.branch} at ${git(ctx, "rev-parse", "--short", "HEAD").out}.`,
      "Pushed, and the claim is refreshed.",
    ],
    next: "Keep working and save again, or run scripts/open-pr.sh --draft when it is done",
  }
}

// Every worktree of the clone that sits under the worktree root, with its branch.
function listTaskWorktrees(ctx, main, root) {
  const out = ctx.run("git", [
    "-C",
    main,
    "worktree",
    "list",
    "--porcelain",
  ]).out
  const found = []
  let path = null
  for (const line of `${out}\n`.split("\n")) {
    if (line.startsWith("worktree ")) path = line.slice(9)
    if (line.startsWith("branch ") && path?.startsWith(`${root}/`))
      found.push({ path, branch: line.slice(18) })
  }
  return found
}

// Decides one worktree: { verdict: "remove" } or { verdict: "keep"|"skip", code, why }.
function judge(ctx, wt, { force, dirtyFirst }) {
  const merged = () =>
    JSON.parse(
      gh(
        ctx,
        "pr",
        "list",
        "--state",
        "merged",
        "--head",
        wt.branch,
        "--json",
        "number"
      )
    ).length > 0
  const dirty = () =>
    ctx.run("git", ["-C", wt.path, "status", "--porcelain"]).out
  const checks = dirtyFirst ? ["dirty", "merged"] : ["merged", "dirty"]
  for (const c of checks) {
    if (c === "merged" && !merged())
      return {
        verdict: "keep",
        code: "NOT_MERGED",
        why: `${wt.branch} has no merged pull request`,
      }
    if (c === "dirty" && !force) {
      const d = dirty()
      if (d)
        return {
          verdict: "skip",
          code: "DIRTY",
          why: `${wt.path} has unsaved work:\n${d.split("\n").slice(0, 8).join("\n")}`,
        }
    }
  }
  return { verdict: "remove" }
}

// Port of scripts/cleanup-worktree.sh: only worktrees under the worktree root, only merged ones,
// never one with unsaved work unless --force. --all handles every worktree, --dry-run removes none.
export function cleanup(ctx, { n: given, flags = {} }) {
  const force = Boolean(flags["--force"])
  const dry = Boolean(flags["--dry-run"])
  const { main, root } = locate(ctx)
  const n = flags["--all"] ? null : (given ?? taskHere(ctx).n)
  const fetched = ctx.run("git", [
    "-C",
    main,
    "fetch",
    "--quiet",
    "--prune",
    "origin",
  ])
  const lines = fetched.ok
    ? []
    : [`Warning: could not fetch origin: ${fetched.err}`]
  const all = listTaskWorktrees(ctx, main, root)
  const targets = n
    ? all.filter((w) => new RegExp(`^[a-z]+/${n}-`).test(w.branch))
    : all
  if (n && !targets.length)
    throw new Refused(
      "NO_WORKTREE",
      `#${n} has no local worktree under ${root} to clean up`
    )

  const removed = []
  for (const wt of targets) {
    const j = judge(ctx, wt, { force, dirtyFirst: Boolean(n) })
    if (j.verdict !== "remove") {
      if (n) throw new Refused(j.code, j.why)
      lines.push(
        `${j.verdict === "keep" ? "kept" : "skipped"} ${wt.branch}: ${j.why.split("\n")[0]}`
      )
      continue
    }
    if (dry) {
      lines.push(`would remove ${wt.path}  (${wt.branch})`)
      continue
    }
    const rm = ctx.run("git", [
      "-C",
      main,
      "worktree",
      "remove",
      ...(force ? ["--force"] : []),
      wt.path,
    ])
    if (!rm.ok)
      throw new Error(`git worktree remove failed: ${rm.err}`.slice(0, 800))
    ctx.run("git", ["-C", main, "branch", "-D", wt.branch])
    removed.push(`${wt.path}  (${wt.branch})`)
  }
  if (!dry) {
    ctx.run("git", ["-C", main, "worktree", "prune"])
    try {
      rmdirSync(root)
    } catch {}
  }
  return {
    lines: [
      ...lines,
      removed.length
        ? "Removed:"
        : dry
          ? "Dry run: nothing removed."
          : "Nothing removed.",
      ...removed.map((x) => `  ${x}`),
    ],
    next: "gh issue list",
  }
}
