import { Refused, writeResult } from "../result.mjs"
import { jobRows, evaluate, refusalError } from "../rules/index.mjs"

export function run(ctx, cmd, args, options = {}) {
  return ctx.ports.proc.run(cmd, args, { cwd: ctx.cwd, ...options })
}
export function must(ctx, cmd, args, options) {
  const r = run(ctx, cmd, args, options)
  if (!r.ok)
    throw new Error(
      `${cmd} ${args.slice(0, 2).join(" ")} failed: ${r.err || r.out}`.slice(
        -1200
      )
    )
  return r.out
}
export const git = (ctx, ...args) => must(ctx, "git", args)
export const gh = (ctx, ...args) => must(ctx, "gh", args)
export const json = (ctx, ...args) => JSON.parse(gh(ctx, ...args))
export function refuse(code, message, fix) {
  if (jobRows.some((row) => row.id === code))
    throw refusalError(evaluate(code, { delivery: { id: code, message, fix } }))
  throw new Refused(code, message, fix)
}
export function task(ctx) {
  const here = ctx.ports.git.here(ctx.cwd)
  const m =
    /^(feat|fix|hotfix|refactor|chore|docs)\/(\d+)-([a-z0-9]+(?:-[a-z0-9]+)*)$/.exec(
      here.branch ?? ""
    )
  const repo = ctx.ports.git.repo(ctx.cwd)
  if (
    !here.topOk ||
    !m ||
    !repo?.root ||
    here.gitDir === here.common ||
    !here.top.startsWith(`${repo.root}/`)
  )
    refuse("NOT_A_TASK", "Run this inside your task worktree.")
  return { ...here, ...repo, type: m[1], n: Number(m[2]), slug: m[3] }
}
export function snapshot(ctx, t) {
  if (git(ctx, "status", "--porcelain"))
    refuse("DIRTY", "Commit the changes before finishing.")
  return {
    tree: git(ctx, "rev-parse", "HEAD^{tree}"),
    base: git(ctx, "rev-parse", "origin/main"),
    branch: t.branch,
  }
}
export function recorded(ctx, script, action) {
  const startedAt = new Date(ctx.now()).toISOString()
  try {
    const result = action()
    writeResult(ctx.env, {
      script,
      id: result.id ?? ctx.ports.git.here(ctx.cwd).branch,
      status: result.exit ? "fail" : (result.status ?? "ok"),
      cause: result.cause,
      detail: result.lines.join(" "),
      next: result.next,
      log: result.log,
      retried: result.retried,
      files: result.files,
      startedAt,
    })
    return result
  } catch (error) {
    writeResult(ctx.env, {
      script,
      id: ctx.ports.git.here(ctx.cwd).branch,
      status: error instanceof Refused ? "fail" : "error",
      cause: error.cause ?? "hygiene",
      detail: error.message,
      next: error.fix,
      startedAt,
    })
    throw error
  }
}
export function diffFacts(ctx, files, head, labels = []) {
  return {
    diff: {
      files,
      labels,
      ciYmlAtHead:
        !files.includes(".github/workflows/ci.yml") ||
        run(ctx, "git", ["cat-file", "-e", `${head}:.github/workflows/ci.yml`])
          .ok,
    },
  }
}
