import { execFileSync } from "node:child_process"
import { appendFileSync, mkdirSync, renameSync, writeFileSync } from "node:fs"
import { homedir } from "node:os"
import { basename, dirname, join } from "node:path"

export const EXIT = Object.freeze({
  ok: 0,
  error: 1,
  refused: 2,
  human: 4,
})

export const SCHEMA = Object.freeze({
  version: 1,
  scripts: Object.freeze([
    "new-task",
    "open-pr",
    "merge-pr",
    "check",
    "release",
  ]),
  status: Object.freeze(["ok", "pending", "fail", "human", "error"]),
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
  CLOSED: "The issue is closed. Run: gh issue list, and pick another.",
  MISSING_FIELDS: "Pass the missing flags. Run: scripts/ocv-tools.mjs help",
  WORKTREE_EXISTS:
    "Work in that worktree, or finish it. Run: gh issue view <n> --comments",
  READY_FOR_HUMAN:
    "Pick another issue: gh issue list --search 'no:assignee -label:ready-for-human'",
  ASSIGNED: "Pick another issue, or pass --take if the owner agreed.",
  BRANCH_EXISTS:
    "Someone is already working on it. Run: gh issue view <n> --comments",
  DISK: "Free space: scripts/ocv-tools.mjs cleanup --all --dry-run lists finished worktrees to remove.",
  NOT_A_REPO: "Run this inside the opencv repository.",
  NOT_A_TASK:
    "Run this from inside a task worktree (../opencv.worktrees/<n>-...), or pass the issue number.",
  NO_WORKTREE: "Nothing to remove. Run: git worktree list",
  NOT_OWNER:
    "Only the author of the pull request merges it. Run: gh pr view <n>",
  DIRTY:
    'Save first: scripts/ocv-tools.mjs save -m "<what you did>", then run cleanup again.',
  NOT_MERGED:
    "Cleanup waits for the pull request to merge; the issue closes then. Run: gh issue view <n> --comments",
  UNKNOWN_FLAG: "That flag is not supported. Run: scripts/ocv-tools.mjs help",
  BAD_ARGS:
    "Pass one target: an issue number or a title, not both. Run: scripts/ocv-tools.mjs help",
  BAD_ISSUE:
    "Pass an issue number of 1 or more, such as 90 or #90. Run: gh issue list",
  DIVERGED:
    "The local branch and origin have diverged. Reconcile both tips, then run take --resume again.",
  UNKNOWN:
    "The issue comments could not be read completely, so no owner was named. Run the command again.",
  BAD_PICTURE: "Pass a picture file (.png, .jpg, .gif or .webp).",
  MISSING_FILE: "Check the path and pass a picture that exists.",
  TOO_BIG: "Pass a picture under 10 MB.",
  TOO_MANY: "Pass at most 20 pictures in one run.",
  ERROR: "Read the message, fix the cause, and run the command again.",
}

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
      code: error.exit ?? EXIT.refused,
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
    cause:
      status === "ok" || status === "pending" ? "none" : r.cause || "other",
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
