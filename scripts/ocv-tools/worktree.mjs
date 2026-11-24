import { join } from "node:path"
import {
  WORKTREE_PORTS,
  localDevUrls,
} from "../../packages/domain/src/local-ports.ts"
import { BRANCH_RE, TYPES } from "./fields.mjs"
import { decide, refusalError } from "./rules/index.mjs"

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

export const descFromTitle = (title) =>
  String(title).replace(/^[a-zA-Z]+(\([^)]*\))?!?:\s*/, "")

export function locate(ctx) {
  const repo = ctx.ports.git.repo(ctx.cwd)
  const fact = !repo
    ? { ok: false, missing: true }
    : repo.bare
      ? { ok: false, bare: repo.bare }
      : { ok: true }
  const verdict = decide("locate", { repo: fact })
  if (!verdict.ok) throw refusalError(verdict.refusals[0])
  return { main: repo.main, root: repo.root }
}

export function takenPath(ctx, issue, desc) {
  const slug = slugify(desc ?? "")
  if (!slug) return null
  const path = join(locate(ctx).root, `${issue}-${slug}`)
  return ctx.ports.fs.exists(path) ? path : null
}

function claimedPorts(fs, root) {
  const ports = new Set()
  if (!fs.exists(root)) return ports
  for (const dir of fs.list(root)) {
    try {
      const m = /^PORT=(\d+)$/m.exec(fs.read(join(root, dir, ".env")))
      if (m) ports.add(Number(m[1]))
    } catch {
      continue
    }
  }
  return ports
}

export const RESERVED_WEB_PORTS = new Set([5432])

export function pickPort(ctx, issue, root) {
  const claimed = claimedPorts(ctx.ports.fs, root)
  const listening = (port) => ctx.ports.proc.listening(port)
  const size = WORKTREE_PORTS.last - WORKTREE_PORTS.first + 1
  for (let step = 0; step < size; step += 1) {
    const port = WORKTREE_PORTS.first + ((issue + step) % size)
    const webPort = localDevUrls(String(port)).webPort
    const webTaken =
      claimed.has(webPort) ||
      listening(webPort) ||
      RESERVED_WEB_PORTS.has(webPort)
    if (!claimed.has(port) && !listening(port) && !webTaken) return port
  }
  throw new Error(
    `no free port in ${WORKTREE_PORTS.first} to ${WORKTREE_PORTS.last}`
  )
}

function installCommand(fs, wt) {
  const has = (file) => fs.exists(join(wt, file))
  if (has("pnpm-lock.yaml")) return ["pnpm", ["install", "--frozen-lockfile"]]
  if (has("yarn.lock")) return ["yarn", ["install"]]
  if (has("package-lock.json")) return ["npm", ["ci"]]
  return ["npm", ["install"]]
}

export function packagesUsedFromBuiltOutput(fs, wt) {
  const root = join(wt, "packages")
  let dirs
  try {
    dirs = fs.list(root)
  } catch {
    return []
  }
  const names = []
  for (const dir of dirs) {
    const path = join(root, dir, "package.json")
    if (!fs.exists(path)) continue
    let manifest
    try {
      manifest = JSON.parse(fs.read(path))
    } catch {
      continue
    }
    const served = JSON.stringify([
      manifest.main,
      manifest.module,
      manifest.types,
      manifest.exports,
    ])
    if (manifest.name && manifest.scripts?.build && served.includes("./dist"))
      names.push(manifest.name)
  }
  return names.sort()
}

export function buildCommand(names) {
  return ["pnpm", [...names.flatMap((name) => ["--filter", name]), "build"]]
}

function fastForward(git, main, branch, remote) {
  const moved = git.fastForward(main, branch, remote)
  if (!moved.ok)
    throw new Error(`could not fast-forward ${branch}: ${moved.err}`)
}

export function createWorktree(
  ctx,
  { type, issue, desc, install = true, resume = false }
) {
  if (!TYPES.includes(type))
    throw new Error(`type must be one of: ${TYPES.join(", ")}`)
  const { main, root } = locate(ctx)
  const warnings = []
  const slug = slugify(desc ?? "")
  if (!slug) throw new Error(`description "${desc ?? ""}" has no usable words`)
  const branch = `${type}/${issue}-${slug}`
  if (!BRANCH_RE.test(branch))
    throw new Error(`built an invalid branch name: ${branch}`)
  if (slug.split("-").length < 3)
    warnings.push(
      `description has ${slug.split("-").length} word(s); 3-5 is the guideline (use -d)`
    )
  const worktree = join(root, `${issue}-${slug}`)
  const fs = ctx.ports.fs

  const git = ctx.ports.git
  const fetched = git.fetch(main, "main")
  if (!fetched.ok)
    throw new Error(`git fetch origin main failed: ${fetched.err}`)
  const local = git.localHead(main, branch)
  const remote = git.remoteHead(main, branch)
  if (resume && remote) {
    const got = git.fetch(main, branch)
    if (!got.ok)
      throw new Error(`git fetch origin ${branch} failed: ${got.err}`)
  }
  let relation = null
  if (resume && local && remote) {
    const facts = git.branchFacts(main, branch)
    if (!facts.local || !facts.remote)
      throw new Error(
        `could not compare ${branch} with origin/${branch}: ${facts.err}`
      )
    relation = facts.relation
  }
  const verdict = decide("take-branch", {
    branch: {
      stage: "create",
      name: branch,
      resume,
      local: Boolean(local),
      remote: Boolean(remote),
      relation,
    },
    issue: { n: issue },
  })
  if (!verdict.ok) throw refusalError(verdict.refusals[0])
  if (relation === "behind") fastForward(git, main, branch, remote)

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
    const built =
      cmd === "pnpm" ? packagesUsedFromBuiltOutput(fs, worktree) : []
    if (ran.ok && built.length) {
      const [buildCmd, buildArgs] = buildCommand(built)
      const made = ctx.ports.proc.run(buildCmd, buildArgs, { cwd: worktree })
      if (!made.ok)
        warnings.push(
          `building ${built.join(", ")} failed, so tests that use them fail until it works; run "${buildCmd} ${buildArgs.join(" ")}" in ${worktree}`
        )
    }
  }
  return { main, worktree, branch, port, gitDir, warnings }
}
