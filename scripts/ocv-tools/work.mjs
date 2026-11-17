import { fileURLToPath } from "node:url"
import { hasReceipt } from "./jobs/affected-tests.mjs"
import { git as readGit, run } from "./jobs/common.mjs"
import { EXIT, FIXES } from "./result.mjs"
import { agentIdFor, heartbeat, nowOf, readClaim, taskHere } from "./claim.mjs"
import { throwPushFailure } from "./push-failure.mjs"
import { decide, refusalError } from "./rules/index.mjs"
import { validateAuthoring } from "./authoring.mjs"
import { locate } from "./worktree.mjs"

const withIssueSuffix = (message, n) =>
  /\(#\d+\)\s*$/.test(message) ? message : `${message} (#${n})`

function lostNow(here, facts) {
  return !decide("save", { here, ...facts }).ok
}

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
  if (!verdict.ok) {
    if (verdict.refusals[0].id === "LOST") return lost(ctx, t, h)
    throw refusalError(verdict.refusals[0])
  }

  validateAuthoring({
    n: t.n,
    issue: read.issue,
    pull: ctx.ports.gh.prs({ state: "open", head: t.branch })[0],
  })

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
  const checked = run(
    ctx,
    "node",
    [fileURLToPath(new URL("../ocv-tools.mjs", import.meta.url)), "check"],
    { cwd: ctx.cwd, inherit: true }
  )
  if (!checked.ok)
    throw new Error(`Checks failed before push: ${checked.err || checked.out}`)
  const head = readGit(ctx, "rev-parse", "HEAD")
  const tree = readGit(ctx, "rev-parse", "HEAD^{tree}")
  if (!hasReceipt(ctx, t.gitDir, head, tree))
    throw new Error(
      "No recorded pass for HEAD; run scripts/ocv-tools.mjs check before pushing."
    )
  const beforePushRead = readClaim(ctx, t.n, true)
  const beforePush = beforePushRead.holder
  if (lostNow(t, { claim: beforePush, me, issue: beforePushRead.issue }))
    return lost(ctx, t, beforePush)
  heartbeat(ctx, t.n, beforePush, me)
  const pushStarted = ctx.now()
  const pushed = git.push(ctx.cwd)
  const pushSeconds = ((ctx.now() - pushStarted) / 1000).toFixed(3)
  if (!pushed.ok) throwPushFailure(ctx, pushed)
  const afterPushRead = readClaim(ctx, t.n, true)
  const afterPush = afterPushRead.holder
  if (lostNow(t, { claim: afterPush, me, issue: afterPushRead.issue }))
    return lostPushed(ctx, t, afterPush)
  heartbeat(ctx, t.n, afterPush, me)
  return {
    lines: [
      `Saved #${t.n} on ${t.branch} at ${git.shortHead(ctx.cwd)}.`,
      `git push connection window: ${pushSeconds}s (includes hook and transfer).`,
      "Pushed, and the claim is refreshed.",
    ],
    next: "Keep working and save again, or run scripts/ocv-tools.mjs finish --body-file <file> when it is done",
  }
}

function workOf(ctx, wt, force) {
  const pulls = ctx.ports.gh.prs({ state: "all", head: wt.branch })
  const open = pulls.some((p) => p.state === "OPEN")
  const merged = !open && pulls.find((p) => p.state === "MERGED")
  const abandoned =
    !open &&
    !merged &&
    pulls.find(
      (p) =>
        p.state === "CLOSED" &&
        p.labels?.some((l) => (l.name ?? l) === "abandoned")
    )
  const issueNo = /^[a-z]+\/(\d+)-/.exec(wt.branch)?.[1]
  const issueNumbers = new Set([
    ...(issueNo ? [Number(issueNo)] : []),
    ...pulls.flatMap((p) =>
      (p.closingIssuesReferences ?? []).map((i) => i.number)
    ),
    ...pulls.flatMap((p) =>
      [
        ...(p.body ?? "").matchAll(
          /\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\s+#(\d+)\b/gi
        ),
      ].map((m) => Number(m[1]))
    ),
  ])
  const issueLabels = [...issueNumbers].flatMap((n) =>
    ctx.ports.gh.issueLabels(n)
  )
  const status = ctx.ports.git.status(wt.path)
  const activity = ctx.ports.activity.inspect(wt.path)
  const retained = merged
    ? ctx.ports.git.retainedHead(wt.path, merged.headRefOid)
    : ["same", "behind"].includes(
        ctx.ports.git.branchFacts(wt.path, wt.branch).relation
      )
  const protection = !issueNumbers.size
    ? "could not establish the associated issue"
    : !status.ok
      ? "could not read worktree status"
      : !activity.safe
        ? activity.reason
        : !retained
          ? "unpublished commits are not retained remotely"
          : issueLabels.includes("ready-for-human") ||
              pulls.some((p) =>
                p.labels?.some((l) => (l.name ?? l) === "ready-for-human")
              )
            ? "ready-for-human work is preserved"
            : ""
  return {
    force: force && !abandoned && !protection && !status.out,
    path: wt.path,
    dirty: protection || status.out,
    branch: wt.branch,
    merged: Boolean(merged),
    abandoned: Boolean(abandoned),
    warnings: activity.warnings ?? [],
  }
}

function removeRootUnlessAnotherWorktreeUsesIt(fs, root) {
  try {
    fs.rmdir(root)
    return true
  } catch {
    return false
  }
}

export function registeredWorktrees(ctx, { main }) {
  return ctx.ports.git.worktrees(main).filter((w) => w.path !== main)
}

export function finishedWorktrees(ctx, place) {
  try {
    return registeredWorktrees(ctx, place).filter((w) => {
      const pulls = ctx.ports.gh.prs({ state: "all", head: w.branch })
      return (
        !pulls.some((p) => p.state === "OPEN") &&
        pulls.some(
          (p) =>
            p.state === "MERGED" ||
            (p.state === "CLOSED" &&
              p.labels?.some((l) => (l.name ?? l) === "abandoned"))
        )
      )
    })
  } catch {
    return []
  }
}

function judge(ctx, wt, { force, n, root, diagnostics }) {
  const work = workOf(ctx, wt, force)
  for (const warning of work.warnings) diagnostics.add(warning)
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

export function cleanup(ctx, { n: given, flags = {}, targets: selected }) {
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
  if (!fetched.ok)
    throw new Error(`cleanup refused: could not fetch origin: ${fetched.err}`)
  const lines = []
  const trees = selected ?? registeredWorktrees(ctx, { main })
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
  const diagnostics = new Set()
  for (const wt of targets) {
    const j = judge(ctx, wt, { force, n, root, diagnostics })
    if (j) {
      lines.push(`${j.verb} ${wt.branch}: ${j.message.split("\n")[0]}`)
      continue
    }
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
    const recheck = judge(ctx, wt, { force, n, root, diagnostics })
    if (recheck) {
      lines.push(
        `${recheck.verb} ${wt.branch}: ${recheck.message.split("\n")[0]}`
      )
      continue
    }
    const rm = ctx.ports.git.removeWorktree(main, wt.path, force)
    if (!rm.ok)
      throw new Error(`git worktree remove failed: ${rm.err}`.slice(0, 800))
    const branch = ctx.ports.git.deleteBranch(main, wt.branch)
    if (!branch.ok)
      lines.push(
        `Warning: could not delete local branch ${wt.branch}: ${branch.err || branch.out}`
      )
    if (merged.length) {
      const remoteHead = ctx.ports.git.retainedRemote(
        main,
        wt.branch,
        merged.map((p) => p.headRefOid).filter(Boolean)
      )
      if (!remoteHead.retained) {
        lines.push(
          `Warning: remote branch ${wt.branch} is preserved: its tip is not proven merged.`
        )
      } else if (remoteHead.oid) {
        const remote = ctx.ports.git.deleteRemoteBranch(
          main,
          wt.branch,
          remoteHead.oid
        )
        if (!remote.ok)
          lines.push(
            `Warning: could not delete remote branch ${wt.branch}: ${remote.err || remote.out}`
          )
      }
    }
    removed.push(`${wt.path}  (${wt.branch})`)
  }
  if (!dry) {
    ctx.ports.git.prune(main)
    removeRootUnlessAnotherWorktreeUsesIt(ctx.ports.fs, root)
  }
  return {
    lines: [
      ...[...diagnostics].map((warning) => `Warning: ${warning}`),
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

export function reconcileFinished(ctx, excluded = []) {
  try {
    const roots = [ctx.cwd, ...excluded].map((path) => {
      const here = ctx.ports.git.here(path)
      if (!here.topOk)
        throw new Error("could not establish the caller worktree root")
      return here.top
    })
    const targets = finishedWorktrees(ctx, locate(ctx)).filter(
      (w) => !roots.includes(w.path)
    )
    if (!targets.length) return []
    return cleanup(ctx, { flags: { "--all": true }, targets }).lines
  } catch (e) {
    return [`Warning: completed worktree reconciliation refused: ${e.message}`]
  }
}
