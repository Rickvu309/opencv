// save and cleanup: keep work safe while holding an issue, and remove the workspace after the merge.
import { dirname, join } from "node:path"
import { EXIT, FIXES, Refused, gh } from "./core.mjs"
import { holderOf } from "./claim-marker.mjs"
import { agentIdFor, git, heartbeat, nowOf, taskHere } from "./claim.mjs"
import { loadIssue, worktreeFor } from "./report.mjs"

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

export function cleanup(ctx, given) {
  const n = given ?? taskHere(ctx).n
  const { worktree, branch } = worktreeFor(ctx, n)
  if (!worktree)
    throw new Refused("NO_WORKTREE", `#${n} has no local worktree to clean up`)
  const dirty = ctx.run("git", ["-C", worktree, "status", "--porcelain"]).out
  if (dirty)
    throw new Refused(
      "DIRTY",
      `${worktree} has unsaved work:\n${dirty.split("\n").slice(0, 8).join("\n")}`
    )
  const prs = JSON.parse(
    gh(
      ctx,
      "pr",
      "list",
      "--state",
      "all",
      "--head",
      branch,
      "--json",
      "number,state"
    )
  )
  if (!prs.some((p) => p.state === "MERGED"))
    throw new Refused(
      "NOT_MERGED",
      `${branch} has no merged pull request${prs.length ? ` (found #${prs[0].number} ${prs[0].state.toLowerCase()})` : ""}`
    )
  const common = git(
    ctx,
    "rev-parse",
    "--path-format=absolute",
    "--git-common-dir"
  ).out
  const main = dirname(common)
  const r = ctx.run(join(main, "scripts/cleanup-worktree.sh"), [String(n)], {
    cwd: main,
  })
  if (!r.ok)
    throw new Error(
      `cleanup-worktree.sh failed: ${r.err || r.out}`.slice(0, 800)
    )
  const removed = r.out
    .split("\n")
    .filter((l) => /^\s*removed\s/.test(l))
    .map((l) => l.trim().replace(/^removed\s+/, ""))
  if (!removed.length)
    throw new Error(
      `cleanup-worktree.sh removed nothing:\n${r.out}`.slice(0, 800)
    )
  return {
    lines: [`Cleaned up #${n}. Removed:`, ...removed.map((x) => `  ${x}`)],
    next: "gh issue list",
  }
}
