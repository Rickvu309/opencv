// The one Result: text layout, exit table, and result.json schema 1.
// Bash scripts still write through scripts/lib/result.sh. This module is the
// writer for node (ocv-tools and scripts/pr.mjs). Both match schema 1.
import { execFileSync } from "node:child_process"
import { appendFileSync, mkdirSync, renameSync, writeFileSync } from "node:fs"
import { homedir } from "node:os"
import { basename, dirname, join } from "node:path"

// 0 ok, 1 error, 2 refused, 3 lost, 4 human. Help prints this table.
// 4 is unused until a bash gate's HUMAN REQUIRED is mapped at the job boundary.
export const EXIT = Object.freeze({
  ok: 0,
  error: 1,
  refused: 2,
  lost: 3,
  human: 4,
})

export const SCHEMA = Object.freeze({
  version: 1,
  scripts: Object.freeze([
    "new-task",
    "open-pr",
    "review-pr",
    "merge-pr",
    "check",
    "release",
  ]),
  status: Object.freeze(["ok", "fail", "human", "error"]),
  causes: Object.freeze([
    "none",
    "behind-main",
    "merge-conflict",
    "test",
    "timing-test",
    "lint",
    "typecheck",
    "build",
    "env",
    "disk",
    "hygiene",
    "deploy",
    "other",
  ]),
  fields: Object.freeze([
    "schema",
    "script",
    "repo",
    "id",
    "status",
    "cause",
    "detail",
    "files",
    "blockedBy",
    "retried",
    "next",
    "log",
    "startedAt",
    "durSec",
  ]),
})

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

// Help prints the exit table from EXIT, and the refusal codes from FIXES.
export function exitText() {
  const codes = Object.entries(EXIT)
    .map(([name, code]) => `${code} ${name}`)
    .join(", ")
  return [
    `Exit codes: ${codes}.`,
    `Refused codes: ${Object.keys(FIXES).join(", ")}.`,
    "Every result ends with a Next: or Fix: line.",
  ].join("\n")
}

// A result is { lines, next } or { lines, fix }. The text always ends in Next: or Fix:.
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
      code: EXIT.refused,
      text: render({
        lines: [`REFUSED ${error.code}: ${error.message}`],
        fix: error.fix ?? FIXES[error.code] ?? FIXES.ERROR,
        tail: error.tail,
      }),
    }
  return {
    code: EXIT.error,
    text: render({
      lines: [`ERROR: ${String(error.message).slice(0, 800)}`],
      fix: FIXES.ERROR,
      tail: error.tail,
    }),
  }
}

const slug = (text) =>
  String(text)
    .replaceAll("/", "-")
    .replace(/[^A-Za-z0-9._#-]/g, "-")

function repoFromGit() {
  try {
    const common = execFileSync(
      "git",
      ["rev-parse", "--path-format=absolute", "--git-common-dir"],
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }
    ).trim()
    return basename(dirname(common))
  } catch {
    return basename(process.cwd())
  }
}

const oneLine = (v) => (v ? String(v).replace(/\s+/g, " ").slice(0, 300) : null)

function isoUtc(value) {
  const date = value instanceof Date ? value : new Date(value)
  return date.toISOString().replace(/\.\d+Z$/, "Z")
}

// writeResult(env, record) swallows a write error and returns null (ocv-tools).
// writeResult(record) throws on a write error and reads process.env (scripts/pr).
// The JSON line is the same schema either way.
export function writeResult(envOrRecord, record) {
  const lenient = record != null
  const env = lenient ? envOrRecord : process.env
  const r = lenient ? record : envOrRecord
  try {
    return writeRecord(env ?? process.env, r)
  } catch (error) {
    if (lenient) return null
    throw error
  }
}

function writeRecord(env, r) {
  const dir = env.PR_RESULT_DIR || join(homedir(), "tmp", "pr-results")
  const repo = env.PR_RESULT_REPO || r.repo || repoFromGit()
  const id = slug(r.id ?? "unknown")
  const status = r.status
  const started = isoUtc(r.startedAt)
  const json = JSON.stringify({
    schema: SCHEMA.version,
    script: r.script,
    repo,
    id,
    status,
    cause: status === "ok" ? "none" : r.cause || "other",
    detail: oneLine(r.detail),
    files: r.files ?? [],
    blockedBy: r.blockedBy ?? null,
    retried: r.retried ?? [],
    next: r.next ?? null,
    log: r.log ?? null,
    startedAt: started,
    durSec: Math.max(0, Math.round((Date.now() - Date.parse(started)) / 1000)),
  })
  const file = join(dir, `${repo}-${r.script}-${id}.json`)
  mkdirSync(dir, { recursive: true })
  const tmp = `${file}.tmp.${process.pid}`
  writeFileSync(tmp, `${json}\n`)
  renameSync(tmp, file)
  appendFileSync(join(dir, "history.jsonl"), `${json}\n`)
  return file
}
