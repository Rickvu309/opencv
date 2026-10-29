// The workflow result file (schema 1, same as scripts/lib/result.sh): one JSON line per run at
// ${PR_RESULT_DIR:-~/tmp/pr-results}/<repo>-<script>-<id>.json, also appended to history.jsonl.
// `take` writes script "new-task" so tools that read the old new-task.sh results keep working.
import { appendFileSync, mkdirSync, renameSync, writeFileSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"

const slug = (text) =>
  String(text)
    .replaceAll("/", "-")
    .replace(/[^A-Za-z0-9._#-]/g, "-")

export function writeResult(env, r) {
  const dir = env.PR_RESULT_DIR || join(homedir(), "tmp", "pr-results")
  const repo = env.PR_RESULT_REPO || r.repo || "unknown"
  const id = slug(r.id ?? "unknown")
  const one = (v) => (v ? String(v).replace(/\s+/g, " ").slice(0, 300) : null)
  const json = JSON.stringify({
    schema: 1,
    script: r.script,
    repo,
    id,
    status: r.status,
    cause: r.cause ?? (r.status === "ok" ? "none" : "other"),
    detail: one(r.detail),
    files: r.files ?? [],
    blockedBy: null,
    retried: [],
    next: r.next ?? null,
    log: null,
    startedAt: r.startedAt,
    durSec: Math.round((Date.now() - Date.parse(r.startedAt)) / 1000),
  })
  const file = join(dir, `${repo}-${r.script}-${id}.json`)
  try {
    mkdirSync(dir, { recursive: true })
    writeFileSync(`${file}.tmp`, `${json}\n`)
    renameSync(`${file}.tmp`, file)
    appendFileSync(join(dir, "history.jsonl"), `${json}\n`)
    return file
  } catch {
    return null
  }
}
