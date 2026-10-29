// save and cleanup: keep work safe while holding an issue, and remove the workspace after the merge.
import { rmdirSync } from "node:fs"
import { EXIT, FIXES, Refused, gh } from "./core.mjs"
import {
  agentIdFor,
  git,
  heartbeat,
  nowOf,
  readClaim,
  taskHere,
} from "./claim.mjs"
import { locate } from "./worktree.mjs"

const withIssueSuffix = (message, n) =>
  /\(#\d+\)\s*$/.test(message) ? message : `${message} (#${n})`

const gitRaw = (ctx, ...args) =>
  ctx.run("git", args, { cwd: ctx.cwd, raw: true })

function holds(h, me) {
  return (
    Boolean(me) &&
    h.agent === me &&
    h.state !== "none" &&
    h.state !== "released"
  )
}

// The diff is raw stdout. Trimming drops a blank context line (a single
// space) and the hunk no longer applies.
function savedPatch(ctx, n) {
  const add = git(ctx, "add", "-A")
  if (!add.ok)
    throw new Error(
      `could not save the lost work: git add failed: ${add.err || add.out}`.slice(
        0,
        800
      )
    )
  const againstMain = gitRaw(ctx, "diff", "--cached", "--binary", "origin/main")
  const diff = againstMain.ok
    ? againstMain
    : gitRaw(ctx, "diff", "--cached", "--binary", "HEAD")
  if (!diff.ok)
    throw new Error(
      `could not save the lost work: git diff failed: ${diff.err || diff.out}`.slice(
        0,
        800
      )
    )
  const stamp = new Date(nowOf(ctx)).toISOString().replace(/[:.]/g, "-")
  const patch = diff.out.endsWith("\n") ? diff.out : `${diff.out}\n`
  return ctx.writeScratch(`lost/${n}-${stamp}.patch`, patch)
}

// Another agent holds the claim: keep our work as a patch and stop.
function lost(ctx, { n }, holder) {
  const path = savedPatch(ctx, n)
  return {
    exit: EXIT.lost,
    lines: [
      `LOST #${n}: ${holder.agent ? `${holder.agent} holds the claim now` : "you no longer hold the claim"}.`,
      `Your work is saved as a patch: ${path}`,
      "Stop working on this issue.",
    ],
    fix: FIXES.LOST,
  }
}

// The push already happened. Say so, and do not patch the old claim comment.
// Uncommitted work still goes to a patch under ~/tmp/ocv-tools/lost.
function lostPushed(ctx, t, holder) {
  const who = holder.agent || "another agent"
  const lines = [
    `LOST #${t.n}: your push already reached origin/${t.branch}; ${who} now holds #${t.n}.`,
  ]
  if (git(ctx, "status", "--porcelain").out) {
    const path = savedPatch(ctx, t.n)
    lines.push(`Your uncommitted work is saved as a patch: ${path}`)
  }
  lines.push("Stop working on this issue.")
  return {
    exit: EXIT.lost,
    lines,
    fix: `The commits are already on origin/${t.branch}. ${who} holds #${t.n}. Stop working in this worktree and do not edit the claim. Run: scripts/ocv-tools.mjs status ${t.n}`,
  }
}

export function save(ctx, { message }) {
  const t = taskHere(ctx)
  if (!message) throw new Error("usage: ocv-tools save -m <message>")
  const me = agentIdFor(ctx, t.gitDir)
  const h = readClaim(ctx, t.n).holder
  if (!holds(h, me)) return lost(ctx, t, h)

  const dirty = git(ctx, "status", "--porcelain").out
  const upstream = git(ctx, "rev-parse", "--verify", `origin/${t.branch}`)
  const ahead = git(
    ctx,
    "rev-list",
    "--count",
    `${upstream.ok ? `origin/${t.branch}` : "origin/main"}..HEAD`
  ).out
  if (!dirty && !Number(ahead)) {
    const still = readClaim(ctx, t.n).holder
    if (!holds(still, me)) return lost(ctx, t, still)
    heartbeat(ctx, t.n, still, me)
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
  // Re-read before the push. A takeover during commit must not publish.
  const again = readClaim(ctx, t.n).holder
  if (!holds(again, me)) return lost(ctx, t, again)
  // Refresh immediately before git push. The pre-push check can take long
  // enough to expire a claim that was fresh at the previous heartbeat.
  heartbeat(ctx, t.n, again, me)
  const pushed = git(ctx, "push", "-u", "origin", "HEAD")
  if (!pushed.ok)
    throw new Error(
      `push failed (the pre-push check may have found a problem; your commit is safe locally): ${pushed.err || pushed.out}`.slice(
        -800
      )
    )
  // Re-read after the push returns, before any success report or a second
  // patch of the claim. A takeover during the hook must not look like success.
  // A comment that arrives after this read can still win. That gap is the
  // residual race.
  const after = readClaim(ctx, t.n).holder
  if (!holds(after, me)) return lostPushed(ctx, t, after)
  heartbeat(ctx, t.n, after, me)
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
