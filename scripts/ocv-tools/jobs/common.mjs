import { Refused, writeResult } from "../result.mjs"
import { decide, refusalError } from "../rules/index.mjs"

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
  ) {
    const verdict = decide("finish", { here: { ok: false } })
    throw refusalError(verdict.refusals[0])
  }
  return { ...here, ...repo, type: m[1], n: Number(m[2]), slug: m[3] }
}
// What finish holds still while it pushes: the tree, the base and whether
// anything is unsaved. finish-pushed compares the one before with the one after.
export function snapshot(ctx, t) {
  return {
    dirty: git(ctx, "status", "--porcelain"),
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
