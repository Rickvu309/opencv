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
      try {
        for (const pid of readdirSync(proc).filter((s) => /^\d+$/.test(s))) {
          if (Number(pid) === process.pid) continue
          const dir = join(proc, pid)
          try {
            if (statSync(dir).uid !== process.getuid()) continue
            const command = readFileSync(join(dir, "cmdline"), "utf8").split(
              "\0"
            )
            const files = [
              "cwd",
              "exe",
              ...readdirSync(join(dir, "fd")).map((fd) => `fd/${fd}`),
            ]
            for (const file of files) {
              try {
                if (
                  contains(
                    path,
                    readlinkSync(join(dir, file)).replace(/ \(deleted\)$/, "")
                  )
                )
                  return {
                    safe: false,
                    reason: `process ${pid} uses the worktree`,
                  }
              } catch (e) {
                if (e.code !== "ENOENT") throw e
              }
            }
            if (
              command.some((arg) => arg.startsWith("/") && contains(path, arg))
            )
              return {
                safe: false,
                reason: `process ${pid} runs from the worktree`,
              }
          } catch (e) {
            if (e.code !== "ENOENT" && e.code !== "ESRCH") throw e
          }
        }
        return { safe: true }
      } catch {
        return {
          safe: false,
          reason: "could not verify active worktree processes",
        }
      }
    },
  }
}
