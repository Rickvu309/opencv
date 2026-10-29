// The workspace engine behind `take`: slug and branch rules, the worktree from the latest
// origin/main, .env with a free port, hooks, install. Ported from the old scripts/new-task.sh.
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs"
import { basename, dirname, join } from "node:path"
import { Refused } from "./core.mjs"
import { diskProblem } from "./disk.mjs"
import { TYPES } from "./fields.mjs"

export const BRANCH_RE =
  /^(feat|fix|hotfix|refactor|chore|docs)\/[0-9]+-[a-z0-9]+(-[a-z0-9]+)*$/
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
  const common = ctx.run(
    "git",
    ["rev-parse", "--path-format=absolute", "--git-common-dir"],
    { cwd: ctx.cwd }
  )
  if (!common.ok)
    throw new Refused("NOT_A_REPO", "run this inside the opencv repository")
  if (basename(common.out) !== ".git")
    throw new Refused("NOT_A_REPO", `expected a non-bare repo (${common.out})`)
  const main = dirname(common.out)
  return { main, root: join(dirname(main), `${basename(main)}.worktrees`) }
}

function portInUse(ctx, p) {
  const ss = ctx.run("ss", ["-ltnH"])
  if (ss.ok)
    return ss.out
      .split("\n")
      .some((l) => new RegExp(`[:.]${p}$`).test(l.trim().split(/\s+/)[3] ?? ""))
  const lsof = ctx.run("lsof", [`-iTCP:${p}`, "-sTCP:LISTEN"])
  return lsof.ok && lsof.out !== ""
}

// Ports other worktrees already hold in their .env (their servers may not run yet).
function claimedPorts(root) {
  const ports = new Set()
  if (!existsSync(root)) return ports
  for (const dir of readdirSync(root)) {
    try {
      const m = /^PORT=(\d+)$/m.exec(
        readFileSync(join(root, dir, ".env"), "utf8")
      )
      if (m) ports.add(Number(m[1]))
    } catch {}
  }
  return ports
}

export function pickPort(ctx, issue, root) {
  const claimed = claimedPorts(root)
  let port = 4000 + (issue % 1000)
  while (claimed.has(port) || portInUse(ctx, port)) {
    port += 1
    if (port >= 65535) throw new Error("no free port found")
  }
  return port
}

function installCommand(wt) {
  const has = (f) => existsSync(join(wt, f))
  if (has("pnpm-lock.yaml")) return ["pnpm", ["install", "--frozen-lockfile"]]
  if (has("yarn.lock")) return ["yarn", ["install"]]
  if (has("package-lock.json")) return ["npm", ["ci"]]
  return ["npm", ["install"]]
}

// Makes the branch and worktree. Returns { main, worktree, branch, port, warnings }.
export function createWorktree(ctx, { type, issue, desc, install = true }) {
  if (!TYPES.includes(type))
    throw new Refused(
      "MISSING_FIELDS",
      `type must be one of: ${TYPES.join(", ")}`
    )
  const { main, root } = locate(ctx)
  const problem = diskProblem(ctx.env ?? process.env, { main, root })
  if (problem) {
    const e = new Refused("DISK", problem.text)
    e.cause = problem.cause
    throw e
  }
  const warnings = []
  const slug = slugify(desc ?? "")
  if (!slug)
    throw new Refused(
      "MISSING_FIELDS",
      `description "${desc}" has no usable characters; pass -d`
    )
  const branch = `${type}/${issue}-${slug}`
  if (!BRANCH_RE.test(branch))
    throw new Error(`built an invalid branch name: ${branch}`)
  if (slug.split("-").length < 3)
    warnings.push(
      `description has ${slug.split("-").length} word(s); 3-5 is the guideline (use -d)`
    )
  const worktree = join(root, `${issue}-${slug}`)
  if (existsSync(worktree))
    throw new Refused(
      "WORKTREE_EXISTS",
      `worktree path already exists: ${worktree}`
    )

  const g = (...args) => ctx.run("git", ["-C", main, ...args])
  const fetched = g("fetch", "--quiet", "origin", "main")
  if (!fetched.ok)
    throw new Error(`git fetch origin main failed: ${fetched.err}`)
  if (g("show-ref", "--verify", "--quiet", `refs/heads/${branch}`).ok)
    throw new Refused(
      "BRANCH_EXISTS",
      `branch ${branch} already exists locally (git worktree list)`
    )
  if (g("ls-remote", "--exit-code", "--heads", "origin", branch).ok)
    throw new Refused(
      "BRANCH_EXISTS",
      `branch ${branch} already exists on origin; someone is already working on it`
    )

  mkdirSync(root, { recursive: true })
  const added = g(
    "worktree",
    "add",
    "--quiet",
    "--no-track",
    "-b",
    branch,
    worktree,
    "origin/main"
  )
  if (!added.ok) throw new Error(`git worktree add failed: ${added.err}`)
  if (existsSync(join(worktree, ".githooks"))) {
    if (g("config", "--get", "core.hooksPath").out !== ".githooks")
      g("config", "core.hooksPath", ".githooks")
  } else warnings.push("no .githooks/ on main: local guardrails are not active")

  const port = pickPort(ctx, issue, root)
  const example = join(worktree, ".env.example")
  if (existsSync(example)) {
    const text = readFileSync(example, "utf8")
    writeFileSync(
      join(worktree, ".env"),
      /^PORT=/m.test(text)
        ? text.replace(/^PORT=.*$/m, `PORT=${port}`)
        : `${text.replace(/\n*$/, "\n")}\nPORT=${port}\n`
    )
  } else {
    writeFileSync(join(worktree, ".env"), `PORT=${port}\n`)
    warnings.push("no .env.example in repo; wrote .env with PORT only")
  }
  const gitDir = ctx.run("git", [
    "-C",
    worktree,
    "rev-parse",
    "--absolute-git-dir",
  ]).out
  writeFileSync(join(gitDir, "assigned-port"), `${port}\n`)

  if (install && existsSync(join(worktree, "package.json"))) {
    const [cmd, args] = installCommand(worktree)
    const r = ctx.run(cmd, args, { cwd: worktree })
    if (!r.ok)
      warnings.push(
        `install failed; run "${cmd} ${args.join(" ")}" in ${worktree}`
      )
  }
  return { main, worktree, branch, port, gitDir, warnings }
}
