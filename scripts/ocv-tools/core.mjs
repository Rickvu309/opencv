// Process runner. Result types live in result.mjs. Jobs reach git, gh, files and
// processes through scripts/ocv-tools/ports.
import { spawnSync } from "node:child_process"
import { homedir } from "node:os"
import { join } from "node:path"

export { EXIT, FIXES, Refused, exitText, failure, render } from "./result.mjs"

export const SCRATCH = join(homedir(), "tmp", "ocv-tools")

export function realRun(cmd, args, options = {}) {
  const r = spawnSync(cmd, args, {
    encoding: "utf8",
    cwd: options.cwd,
    maxBuffer: 32 * 1024 * 1024,
  })
  const stdout = r.stdout ?? ""
  return {
    ok: r.status === 0,
    // raw keeps patch bytes. trim() drops a trailing context line that is
    // only a space, and git apply then rejects the hunk.
    out: options.raw ? stdout : stdout.trim(),
    err: (r.stderr ?? r.error?.message ?? "").trim(),
  }
}

export function gh(ctx, ...args) {
  const r = ctx.run("gh", args)
  if (!r.ok)
    throw new Error(
      `gh ${args.slice(0, 2).join(" ")} failed: ${r.err || r.out}`
    )
  return r.out
}
