import {
  existsSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  statSync,
} from "node:fs"
import { homedir } from "node:os"
import { join, resolve } from "node:path"
import { createRequire } from "node:module"

const require = createRequire(import.meta.url)
const contains = (root, path) => path === root || path.startsWith(`${root}/`)

export function threadActivity(rows) {
  if (!rows.length)
    return { safe: false, reason: "no thread completion record" }
  if (
    rows.some(
      (r) =>
        !["completed", "failed", "cancelled", "interrupted"].includes(r.status)
    )
  )
    return {
      safe: false,
      reason: "a worktree thread is running or has unknown state",
    }
  return { safe: true }
}

export function processActivity(
  path,
  {
    proc = "/proc",
    io = { readdirSync, readFileSync, readlinkSync, statSync },
  } = {}
) {
  const warnings = new Set()
  function read(file, operation, fallback) {
    try {
      return operation(file)
    } catch (e) {
      if (e.code !== "ENOENT" && e.code !== "ESRCH") {
        const entry = join(proc, file.slice(proc.length + 1).split("/")[0])
        warnings.add(
          `Unreadable process entry ${entry}: ${e.code ?? "read failed"}`
        )
      }
      return fallback
    }
  }
  let pids
  try {
    pids = io.readdirSync(proc)
  } catch {
    return { safe: false, reason: "could not list active worktree processes" }
  }
  for (const pid of pids.filter((s) => /^\d+$/.test(s))) {
    if (Number(pid) === process.pid) continue
    const dir = join(proc, pid)
    const uid = read(dir, (file) => io.statSync(file).uid, null)
    if (uid !== process.getuid()) continue
    const command = read(
      join(dir, "cmdline"),
      (file) => io.readFileSync(file, "utf8"),
      ""
    ).split("\0")
    const tasks = read(join(dir, "task"), (file) => io.readdirSync(file), [])
    const links = [
      dir,
      ...tasks
        .filter((tid) => /^\d+$/.test(tid))
        .map((tid) => join(dir, "task", tid)),
    ].flatMap((root) => {
      const fds = read(join(root, "fd"), (file) => io.readdirSync(file), [])
      return ["cwd", "exe", ...fds.map((fd) => `fd/${fd}`)].map((file) =>
        join(root, file)
      )
    })
    for (const file of links) {
      const target = read(file, (entry) => io.readlinkSync(entry), "")
      if (contains(path, target.replace(/ \(deleted\)$/, "")))
        return {
          safe: false,
          reason: `process ${pid} uses the worktree`,
          warnings: [...warnings],
        }
    }
    if (command.some((arg) => arg.includes(path)))
      return {
        safe: false,
        reason: `process ${pid} names the worktree`,
        warnings: [...warnings],
      }
  }
  return { safe: true, warnings: [...warnings] }
}

export function activityAdapter({ home = homedir(), proc = "/proc" } = {}) {
  function threads(path) {
    const file = join(home, ".t3/userdata/statev2.sqlite")
    if (!existsSync(file))
      return contains(join(home, ".t3/worktrees"), path)
        ? { safe: false, reason: "thread state is unavailable" }
        : { safe: true }
    let db
    try {
      const { DatabaseSync } = require("node:sqlite")
      db = new DatabaseSync(file, { readOnly: true })
      const rows = db
        .prepare(
          `SELECT (SELECT r.status FROM orchestration_v2_projection_runs r WHERE r.thread_id=t.thread_id ORDER BY r.ordinal DESC LIMIT 1) AS status FROM orchestration_v2_projection_threads t WHERE json_extract(t.payload_json,'$.worktreePath')=?`
        )
        .all(path)
      return rows.length || contains(join(home, ".t3/worktrees"), path)
        ? threadActivity(rows)
        : { safe: true }
    } catch {
      return { safe: false, reason: "could not verify worktree thread state" }
    } finally {
      db?.close()
    }
  }

  return {
    inspect(path) {
      path = resolve(path)
      const thread = threads(path)
      if (!thread.safe) return thread
      return processActivity(path, { proc })
    },
  }
}
