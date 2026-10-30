// The workspace engine behind `take`: slug and branch rules, the worktree from the latest
// origin/main, .env with a free port, hooks, install. Ported from the old scripts/new-task.sh.
// Git, files and process checks go through ports.
import { join } from "node:path"
import { diskProblem } from "./disk.mjs"
import { BRANCH_RE, TYPES } from "./fields.mjs"
import { evaluate, refusalError } from "./rules/index.mjs"

export { BRANCH_RE } from "./fields.mjs"
export const MAX_WORDS = 5

export function slugify(text) {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .split("-")
    .slice(0, MAX_WORDS)
    .join("-")
}

// Drop a leading "type:" or "type(scope):" from an issue title.
export const descFromTitle = (title) =>
  String(title).replace(/^[a-zA-Z]+(\([^)]*\))?!?:\s*/, "")

// The main checkout and the worktree root, from any worktree of the clone.
export function locate(ctx) {
  const repo = ctx.ports.git.repo(ctx.cwd)
  if (!repo)
    throw refusalError(evaluate("NOT_A_REPO", { repo: { missing: true } }))
  if (repo.bare)
    throw refusalError(evaluate("NOT_A_REPO", { repo: { bare: repo.bare } }))
  return { main: repo.main, root: repo.root }
}

// Ports other worktrees already hold in their .env (their servers may not run yet).
function claimedPorts(fs, root) {
  const ports = new Set()
  if (!fs.exists(root)) return ports
  for (const dir of fs.list(root)) {
    try {
      const m = /^PORT=(\d+)$/m.exec(fs.read(join(root, dir, ".env")))
      if (m) ports.add(Number(m[1]))
    } catch {
      // a worktree with no .env holds no port
    }
  }
  return ports
}

export function pickPort(ctx, issue, root) {
  const claimed = claimedPorts(ctx.ports.fs, root)
  let port = 4000 + (issue % 1000)
  while (claimed.has(port) || ctx.ports.proc.listening(port)) {
    port += 1
    if (port >= 65535) throw new Error("no free port found")
  }
  return port
}

function installCommand(fs, wt) {
  const has = (file) => fs.exists(join(wt, file))
  if (has("pnpm-lock.yaml")) return ["pnpm", ["install", "--frozen-lockfile"]]
  if (has("yarn.lock")) return ["yarn", ["install"]]
  if (has("package-lock.json")) return ["npm", ["ci"]]
  return ["npm", ["install"]]
}

// Local and origin both have the branch. Fast-forward when local is a strict
// ancestor. Refuse when the tips have diverged so resume cannot drop the push.
function alignResume(git, main, branch, issue) {
  const facts = git.branchFacts(main, branch)
  if (!facts.local || !facts.remote)
    throw new Error(
      `could not compare ${branch} with origin/${branch}: ${facts.err}`
    )
  if (facts.relation === "same" || facts.relation === "ahead") return
  if (facts.relation === "behind") {
    const moved = git.fastForward(main, branch, facts.remote)
    if (!moved.ok)
      throw new Error(`could not fast-forward ${branch}: ${moved.err}`)
    return
  }
  throw refusalError(
    evaluate("DIVERGED", {
      branch: { name: branch, relation: "diverged" },
      issue: { n: issue },
    })
  )
}

// Makes the branch and worktree. Returns { main, worktree, branch, port, warnings }.
// resume checks out a branch that already exists instead of creating one.
export function createWorktree(
  ctx,
  { type, issue, desc, install = true, resume = false, held = null }
) {
  if (!TYPES.includes(type))
    throw refusalError(evaluate("MISSING_FIELDS", { flags: {}, type }))
  const { main, root } = locate(ctx)
  const env = ctx.env ?? process.env
  const problem = diskProblem(ctx.ports.fs, env, { main, root })
  if (problem) throw refusalError(evaluate("DISK", { disk: problem }))
  const warnings = []
  const slug = slugify(desc ?? "")
  if (!slug)
    throw refusalError(
      evaluate("MISSING_FIELDS", { flags: {}, desc: desc ?? "" })
    )
  const branch = `${type}/${issue}-${slug}`
  if (!BRANCH_RE.test(branch))
    throw new Error(`built an invalid branch name: ${branch}`)
  if (slug.split("-").length < 3)
    warnings.push(
      `description has ${slug.split("-").length} word(s); 3-5 is the guideline (use -d)`
    )
  const worktree = join(root, `${issue}-${slug}`)
  const fs = ctx.ports.fs
  if (fs.exists(worktree))
    throw refusalError(
      evaluate("WORKTREE_EXISTS", {
        path: worktree,
        issue: { n: issue },
        local: {},
      })
    )

  const git = ctx.ports.git
  const fetched = git.fetch(main, "main")
  if (!fetched.ok)
    throw new Error(`git fetch origin main failed: ${fetched.err}`)
  const local = git.localHead(main, branch)
  const remote = git.remoteHead(main, branch)
  const branchHit = evaluate("BRANCH_EXISTS", {
    branch: {
      stage: "create",
      name: branch,
      resume,
      local: Boolean(local),
      remote: Boolean(remote),
      held,
    },
    issue: { n: issue },
  })
  if (branchHit) throw refusalError(branchHit)
  if (resume && remote) {
    const got = git.fetch(main, branch)
    if (!got.ok)
      throw new Error(`git fetch origin ${branch} failed: ${got.err}`)
  }
  // A stale local branch must not hide commits another clone already pushed.
  if (resume && local && remote) alignResume(git, main, branch, issue)

  fs.mkdir(root)
  const added = git.addWorktree(main, {
    path: worktree,
    branch,
    mode: resume && local ? "local" : resume ? "track" : "new",
    start: resume ? `origin/${branch}` : "origin/main",
  })
  if (!added.ok) throw new Error(`git worktree add failed: ${added.err}`)
  if (fs.exists(join(worktree, ".githooks"))) {
    if (git.config(main, "core.hooksPath") !== ".githooks")
      git.setConfig(main, "core.hooksPath", ".githooks")
  } else warnings.push("no .githooks/ on main: local guardrails are not active")

  const port = pickPort(ctx, issue, root)
  const example = join(worktree, ".env.example")
  if (fs.exists(example)) {
    const text = fs.read(example)
    fs.write(
      join(worktree, ".env"),
      /^PORT=/m.test(text)
        ? text.replace(/^PORT=.*$/m, `PORT=${port}`)
        : `${text.replace(/\n*$/, "\n")}\nPORT=${port}\n`
    )
  } else {
    fs.write(join(worktree, ".env"), `PORT=${port}\n`)
    warnings.push("no .env.example in repo; wrote .env with PORT only")
  }
  const gitDir = added.gitDir
  fs.write(join(gitDir, "assigned-port"), `${port}\n`)

  if (install && fs.exists(join(worktree, "package.json"))) {
    const [cmd, args] = installCommand(fs, worktree)
    const ran = ctx.ports.proc.run(cmd, args, { cwd: worktree })
    if (!ran.ok)
      warnings.push(
        `install failed; run "${cmd} ${args.join(" ")}" in ${worktree}`
      )
  }
  return { main, worktree, branch, port, gitDir, warnings }
}

// Drop a worktree take just created when it has no commits and no tracked edits.
// Untracked setup files (.env) do not count. Returns false when it stays.
export function discardWorktree(ctx, { main, worktree, branch }) {
  const status = ctx.ports.git.status(worktree)
  if (!status.ok) return false
  const tracked = status.out
    .split("\n")
    .filter((line) => line && !line.startsWith("??"))
  const ahead = ctx.ports.git.ahead(worktree, "origin/main..HEAD")
  if (tracked.length || !ahead.ok || ahead.n > 0) return false
  const removed = ctx.ports.git.removeWorktree(main, worktree, true)
  if (!removed.ok) return false
  ctx.ports.git.deleteBranch(main, branch)
  return true
}
