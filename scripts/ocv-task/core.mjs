// Shared plumbing: the command runner (injectable so tests never touch the network), the
// refusal type and the result format. Every result prints what happened plus a Next: or Fix: line.
import { spawnSync } from "node:child_process"
import { homedir } from "node:os"
import { join } from "node:path"

// Exit codes: 0 ok, 1 error, 2 refused with a named code, 3 LOST (reserved for the later
// take/save slices: another agent took the claim; nothing in this slice throws it).
export const EXIT = { OK: 0, ERROR: 1, REFUSED: 2, LOST: 3 }

export const SCRATCH = join(homedir(), "tmp", "ocv-task")

export class Refused extends Error {
  constructor(code, message) {
    super(message)
    this.code = code
  }
}

export const FIXES = {
  UNKNOWN_COMMAND: "Run: scripts/ocv-task.mjs help",
  UNREADABLE:
    "Rewrite the plain sections the way `file --dry-run` explains and copy a model issue. Move technical notes under Details for the agent.",
  NOT_AN_ISSUE:
    "That number is not an issue (it may be a pull request). Run: gh issue list",
  NEEDS_APPROVAL: "Ask the owner to comment /approve on the issue.",
  CLOSED: "The issue is closed. Run: gh issue list, and pick another.",
  MISSING_FIELDS: "Pass the missing flags. Run: scripts/ocv-task.mjs help",
  LOST: "Another agent took the claim. Your work is saved as a patch under ~/tmp.",
  ERROR: "Read the message, fix the cause, and run the command again.",
}

export function realRun(cmd, args, options = {}) {
  const r = spawnSync(cmd, args, {
    encoding: "utf8",
    cwd: options.cwd,
    maxBuffer: 32 * 1024 * 1024,
  })
  return {
    ok: r.status === 0,
    out: (r.stdout ?? "").trim(),
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

// A result is { lines: [...], next } or { lines, fix }. Joined into the text the command prints.
export function render({ lines, next, fix }) {
  const out = [...lines]
  if (next) out.push(`Next: ${next}`)
  if (fix) out.push(`Fix: ${fix}`)
  return out.join("\n")
}

export function failure(error) {
  if (error instanceof Refused)
    return {
      code: EXIT.REFUSED,
      text: render({
        lines: [`REFUSED ${error.code}: ${error.message}`],
        fix: FIXES[error.code] ?? FIXES.ERROR,
      }),
    }
  return {
    code: EXIT.ERROR,
    text: render({
      lines: [`ERROR: ${String(error.message).slice(0, 800)}`],
      fix: FIXES.ERROR,
    }),
  }
}
