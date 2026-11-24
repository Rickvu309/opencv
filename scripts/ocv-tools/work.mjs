import { taskHere } from "./claim.mjs"
import { throwPushFailure } from "./push-failure.mjs"
import { decide, refusalError } from "./rules/index.mjs"
import { validateAuthoring } from "./authoring.mjs"
import { locate } from "./worktree.mjs"

const withIssueSuffix = (message, n) =>
  /\(#\d+\)\s*$/.test(message) ? message : `${message} (#${n})`

export function save(ctx, { message }) {
  const t = taskHere(ctx, "save")
  if (!message) throw new Error("usage: ocv-tools save -m <message>")
  const git = ctx.ports.git
  validateAuthoring({
    n: t.n,
    issue: ctx.facts.load(t.n, ["issue"]).issue,
    pull: ctx.ports.gh.prs({ state: "open", head: t.branch })[0],
  })

  const dirty = git.status(ctx.cwd).out
  const upstream = git.verify(ctx.cwd, `origin/${t.branch}`)
  const ahead = git.ahead(
    ctx.cwd,
    `${upstream.ok ? `origin/${t.branch}` : "origin/main"}..HEAD`
  ).out
  if (!dirty && !Number(ahead))
    return {
      lines: [
        `Nothing to save in #${t.n}: no changes and nothing waiting to upload.`,
      ],
      next: "Keep working, or run scripts/ocv-tools.mjs finish --body-file <file> when it is done",
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
  const pushStarted = ctx.now()
  const pushed = git.push(ctx.cwd)
  const pushSeconds = ((ctx.now() - pushStarted) / 1000).toFixed(3)
  if (!pushed.ok) throwPushFailure(ctx, pushed)
  return {
    lines: [
      `Saved #${t.n} on ${t.branch} at ${git.shortHead(ctx.cwd)}.`,
      `git push connection window: ${pushSeconds}s (includes hook and transfer).`,
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
