// Shared plumbing: the command runner (injectable so tests never touch the network), the
// refusal type and the result format. Every result prints what happened plus a Next: or Fix: line.
import { spawnSync } from "node:child_process"
import { homedir } from "node:os"
import { join } from "node:path"

// Exit codes: 0 ok, 1 error, 2 refused with a named code, 3 LOST (another agent took the claim; save returns it).
export const EXIT = { OK: 0, ERROR: 1, REFUSED: 2, LOST: 3 }

export const SCRATCH = join(homedir(), "tmp", "ocv-tools")

export class Refused extends Error {
  constructor(code, message, fix) {
    super(message)
    this.code = code
    if (fix) this.fix = fix
  }
}

export const FIXES = {
  UNKNOWN_COMMAND: "Run: scripts/ocv-tools.mjs help",
  UNREADABLE:
    "Rewrite the plain sections the way `file --dry-run` explains and copy a model issue. Move technical notes under Details for the agent.",
  NOT_AN_ISSUE:
    "That number is not an issue (it may be a pull request). Run: gh issue list",
  NEEDS_APPROVAL: "Ask the owner to comment /approve on the issue.",
  CLOSED: "The issue is closed. Run: gh issue list, and pick another.",
  MISSING_FIELDS: "Pass the missing flags. Run: scripts/ocv-tools.mjs help",
  HELD: "Pick another issue, or wait until the holder has been idle for 180 minutes. Run: scripts/ocv-tools.mjs status <n>",
  WORKTREE_EXISTS:
    "Work in that worktree, or finish it. Run: scripts/ocv-tools.mjs status <n>",
  READY_FOR_HUMAN:
    "Pick another issue: gh issue list --search 'no:assignee -label:ready-for-human'",
  ASSIGNED: "Pick another issue, or pass --take if the owner agreed.",
  BRANCH_EXISTS:
    "Someone is already working on it. Run: scripts/ocv-tools.mjs status <n>",
  DISK: "Free space: scripts/ocv-tools.mjs cleanup --all --dry-run lists finished worktrees to remove.",
  NOT_A_REPO: "Run this inside the opencv repository.",
  NOT_A_TASK:
    "Run this from inside a task worktree (../opencv.worktrees/<n>-...), or pass the issue number.",
  NO_WORKTREE: "Nothing to remove. Run: git worktree list",
  NOT_OWNER:
    "Only the agent that holds the issue can release it. Run: scripts/ocv-tools.mjs status <n>",
  DIRTY:
    'Save first: scripts/ocv-tools.mjs save -m "<what you did>", then run cleanup again.',
  NOT_MERGED:
    "Cleanup waits for the merge. Run: scripts/ocv-tools.mjs status <n>",
  UNKNOWN_FLAG: "That flag is not supported. Run: scripts/ocv-tools.mjs help",
  BAD_ARGS:
    "Pass one target: an issue number or a title, not both. Run: scripts/ocv-tools.mjs help",
  BAD_ISSUE:
    "Pass an issue number of 1 or more, such as 90 or #90. Run: gh issue list",
  DIVERGED:
    "The local branch and origin have diverged. Reconcile both tips, then run take --resume again.",
  UNKNOWN:
    "The claim history is incomplete, so no holder was decided. Run the command again.",
  LOST: "Another agent took the claim. Your work is saved as a patch under ~/tmp/ocv-tools/lost. Stop and pick another issue.",
  ERROR: "Read the message, fix the cause, and run the command again.",
}

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

// A result is { lines: [...], next } or { lines, fix }. Joined into the text the command prints.
export function render({ lines, next, fix, tail }) {
  const out = [...lines]
  if (next) out.push(`Next: ${next}`)
  if (fix) out.push(`Fix: ${fix}`)
  if (tail) out.push(tail)
  return out.join("\n")
}

export function failure(error) {
  if (error instanceof Refused)
    return {
      code: EXIT.REFUSED,
      text: render({
        lines: [`REFUSED ${error.code}: ${error.message}`],
        fix: error.fix ?? FIXES[error.code] ?? FIXES.ERROR,
        tail: error.tail,
      }),
    }
  return {
    code: EXIT.ERROR,
    text: render({
      lines: [`ERROR: ${String(error.message).slice(0, 800)}`],
      fix: FIXES.ERROR,
      tail: error.tail,
    }),
  }
}
