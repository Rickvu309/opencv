// save and cleanup: keep work safe while holding an issue, and remove the workspace after the merge.
import { EXIT, FIXES } from "./result.mjs"
import { agentIdFor, heartbeat, nowOf, readClaim, taskHere } from "./claim.mjs"
import { decide, refusalError } from "./rules/index.mjs"
import { locate } from "./worktree.mjs"

const withIssueSuffix = (message, n) =>
  /\(#\d+\)\s*$/.test(message) ? message : `${message} (#${n})`

// Another agent holds the claim: the save rows refuse on fresh facts.
function lostNow(here, facts) {
  return !decide("save", { here, ...facts }).ok
}

// The diff is raw stdout. Trimming drops a blank context line (a single
// space) and the hunk no longer applies.
function savedPatch(ctx, n) {
  const git = ctx.ports.git
  const add = git.add(ctx.cwd)
  if (!add.ok)
    throw new Error(
      `could not save the lost work: git add failed: ${add.err || add.out}`.slice(
        0,
        800
      )
    )
  const againstMain = git.diffCached(ctx.cwd, "origin/main")
  const diff = againstMain.ok ? againstMain : git.diffCached(ctx.cwd, "HEAD")
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
  if (ctx.ports.git.status(ctx.cwd).out) {
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
  const t = taskHere(ctx, "save")
  if (!message) throw new Error("usage: ocv-tools save -m <message>")
  const me = agentIdFor(ctx, t.gitDir)
  const git = ctx.ports.git
  const read = readClaim(ctx, t.n)
  const h = read.holder
  const verdict = decide("save", {
    here: t,
    issue: read.issue,
    claim: h,
    me,
  })
  // LOST is exit 3 and a patch, not a REFUSED line.
  if (!verdict.ok) {
    if (verdict.refusals[0].id === "LOST") return lost(ctx, t, h)
    throw refusalError(verdict.refusals[0])
  }

  const dirty = git.status(ctx.cwd).out
  const upstream = git.verify(ctx.cwd, `origin/${t.branch}`)
  const ahead = git.ahead(
    ctx.cwd,
    `${upstream.ok ? `origin/${t.branch}` : "origin/main"}..HEAD`
  ).out
  if (!dirty && !Number(ahead)) {
    const stillRead = readClaim(ctx, t.n, true)
    const still = stillRead.holder
    if (lostNow(t, { claim: still, me, issue: stillRead.issue }))
      return lost(ctx, t, still)
    heartbeat(ctx, t.n, still, me)
    return {
      lines: [
        `Nothing to save in #${t.n}: no changes and nothing waiting to upload. The claim is refreshed.`,
      ],
      next: "Keep working, or run scripts/ocv-tools.mjs finish --body-file <file> when it is done",
    }
  }
  if (dirty) {
    const add = git.add(ctx.cwd)
    const commit = add.ok
      ? git.commit(ctx.cwd, withIssueSuffix(message, t.n))
      : add
    if (!commit.ok)
      throw new Error(
        `commit failed: ${commit.err || commit.out}`.slice(0, 800)
      )
  }
  // Re-read before the push. A takeover during commit must not publish.
  const againRead = readClaim(ctx, t.n, true)
  const again = againRead.holder
  if (lostNow(t, { claim: again, me, issue: againRead.issue }))
    return lost(ctx, t, again)
  // Refresh immediately before git push. The pre-push checks can take a while
  // enough to expire a claim that was fresh at the previous heartbeat.
  heartbeat(ctx, t.n, again, me)
  const pushed = git.push(ctx.cwd)
  if (!pushed.ok)
    throw new Error(
      `push failed (the pre-push checks may have found a problem; your commit is safe locally): ${pushed.err || pushed.out}`.slice(
        -800
      )
    )
  // Re-read after the push returns, before any success report or a second
  // patch of the claim. A takeover during the hook must not look like success.
  // A comment that arrives after this read can still win. That gap is the
  // residual race.
  const afterRead = readClaim(ctx, t.n, true)
  const after = afterRead.holder
  if (lostNow(t, { claim: after, me, issue: afterRead.issue }))
    return lostPushed(ctx, t, after)
  heartbeat(ctx, t.n, after, me)
  return {
    lines: [
      `Saved #${t.n} on ${t.branch} at ${git.shortHead(ctx.cwd)}.`,
      "Pushed, and the claim is refreshed.",
    ],
    next: "Keep working and save again, or run scripts/ocv-tools.mjs finish --body-file <file> when it is done",
  }
}

function workOf(ctx, wt, force) {
  return {
    force,
    path: wt.path,
    dirty: ctx.ports.git.status(wt.path).out,
    branch: wt.branch,
    merged: ctx.ports.gh.prs({ state: "merged", head: wt.branch }).length > 0,
  }
}

// Worktrees under the root whose pull request already merged: a human merge in
// the GitHub UI skips merge --wait, so nothing removed them. Best-effort: a
// GitHub or git failure yields an empty list, never a refusal.
export function finishedWorktrees(ctx, { main, root }) {
  try {
    return ctx.ports.git
      .worktrees(main)
      .filter((w) => w.path.startsWith(`${root}/`))
      .filter(
        (w) => ctx.ports.gh.prs({ state: "merged", head: w.branch }).length > 0
      )
  } catch {
    return []
  }
}

// One numbered worktree refuses on the first row (dirty, then not merged).
// --all keeps what it cannot remove: merged first, then unsaved work.
function judge(ctx, wt, { force, n, root }) {
  const work = workOf(ctx, wt, force)
  const verdict = decide("cleanup", {
    here: { ok: true },
    local: { required: Boolean(n), found: true, n, root },
    work,
  })
  if (n) {
    if (!verdict.ok) throw refusalError(verdict.refusals[0])
    return null
  }
  const unmerged = verdict.refusals.find((r) => r.id === "NOT_MERGED")
  if (unmerged) return { verb: "kept", message: unmerged.message }
  const unsaved = verdict.refusals.find((r) => r.id === "DIRTY")
  if (unsaved) return { verb: "skipped", message: unsaved.message }
  return null
}

// Port of scripts/cleanup-worktree.sh: only worktrees under the worktree root, only merged ones,
// never one with unsaved work unless --force. --all handles every worktree, --dry-run removes none.
export function cleanup(ctx, { n: given, flags = {} }) {
  const force = Boolean(flags["--force"])
  const dry = Boolean(flags["--dry-run"])
  const all = Boolean(flags["--all"])
  let main
  let root
  let n
  if (all || given) {
    const place = locate(ctx)
    main = place.main
    root = place.root
    n = all ? null : given
  } else {
    const here = taskHere(ctx, "cleanup")
    main = here.main
    root = here.root
    n = here.n
  }
  const fetched = ctx.ports.git.fetch(main, undefined, { prune: true })
  const lines = fetched.ok
    ? []
    : [`Warning: could not fetch origin: ${fetched.err}`]
  const trees = ctx.ports.git
    .worktrees(main)
    .filter((w) => w.path.startsWith(`${root}/`))
  const targets = n
    ? trees.filter((w) => new RegExp(`^[a-z]+/${n}-`).test(w.branch))
    : trees
  if (n && !targets.length) {
    const verdict = decide("cleanup", {
      here: { ok: true },
      local: { required: true, found: false, n, root },
    })
    throw refusalError(verdict.refusals[0])
  }

  const removed = []
  const closed = []
  for (const wt of targets) {
    const j = judge(ctx, wt, { force, n, root })
    if (j) {
      lines.push(`${j.verb} ${wt.branch}: ${j.message.split("\n")[0]}`)
      continue
    }
    // The merge queue can land a PR whose body lacked Closes #n; the issue must still end up closed.
    const merged = dry
      ? []
      : ctx.ports.gh.prs({ state: "merged", head: wt.branch })
    const issueNo = /^[a-z]+\/(\d+)-/.exec(wt.branch)?.[1]
    if (
      merged[0] &&
      issueNo &&
      ctx.ports.gh.closeIssue(issueNo, merged[0].number)
    )
      closed.push(
        `Closed issue #${issueNo}: PR #${merged[0].number} merged and left it open.`
      )
    if (dry) {
      lines.push(`would remove ${wt.path}  (${wt.branch})`)
      continue
    }
    const rm = ctx.ports.git.removeWorktree(main, wt.path, force)
    if (!rm.ok)
      throw new Error(`git worktree remove failed: ${rm.err}`.slice(0, 800))
    ctx.ports.git.deleteBranch(main, wt.branch)
    // The queue deletes the remote branch on merge, so a missing ref is the
    // common case and says nothing; only a delete that really failed warns.
    if (ctx.ports.git.remoteHead(main, wt.branch)) {
      const remote = ctx.ports.git.deleteRemoteBranch(main, wt.branch)
      if (!remote.ok)
        lines.push(
          `Warning: could not delete remote branch ${wt.branch}: ${remote.err || remote.out}`
        )
    }
    removed.push(`${wt.path}  (${wt.branch})`)
  }
  if (!dry) {
    ctx.ports.git.prune(main)
    try {
      ctx.ports.fs.rmdir(root)
    } catch {
      // the root stays while another worktree still uses it
    }
  }
  return {
    lines: [
      ...lines,
      ...closed,
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
