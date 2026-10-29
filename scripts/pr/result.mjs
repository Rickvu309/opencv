// Writes a workflow result in the schema of scripts/lib/result.sh (validated by
// scripts/lib/result-check.mjs), for node scripts that cannot source result.sh.
import { appendFileSync, mkdirSync, renameSync, writeFileSync } from "node:fs"
import { homedir } from "node:os"
import { basename, dirname, join } from "node:path"
import { execFileSync } from "node:child_process"

function repoName() {
  if (process.env.PR_RESULT_REPO) return process.env.PR_RESULT_REPO
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

const slug = (id) => id.replace(/\//g, "-").replace(/[^A-Za-z0-9._#-]/g, "-")

// Returns the path written. status: ok|fail|human|error; cause per result-check.mjs.
export function writeResult({
  script,
  id,
  status,
  cause,
  detail,
  next,
  startedAt,
}) {
  const repo = repoName()
  const record = {
    schema: 1,
    script,
    repo,
    id: slug(id),
    status,
    cause: status === "ok" ? "none" : cause,
    detail: detail.replace(/\s+/g, " ").slice(0, 300) || null,
    files: [],
    blockedBy: null,
    retried: [],
    next: next ?? null,
    log: null,
    startedAt: startedAt.toISOString().replace(/\.\d+Z$/, "Z"),
    durSec: Math.round((Date.now() - startedAt.getTime()) / 1000),
  }
  const dir =
    process.env.PR_RESULT_DIR ??
    join(process.env.HOME ?? homedir(), "tmp/pr-results")
  const file = join(dir, `${repo}-${script}-${record.id}.json`)
  const line = JSON.stringify(record)
  mkdirSync(dir, { recursive: true })
  const tmp = `${file}.tmp.${process.pid}`
  writeFileSync(tmp, `${line}\n`)
  renameSync(tmp, file)
  appendFileSync(join(dir, "history.jsonl"), `${line}\n`)
  return file
}
