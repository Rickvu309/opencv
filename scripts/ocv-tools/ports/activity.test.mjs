import assert from "node:assert/strict"
import test from "node:test"
import { activityAdapter, processActivity } from "./activity.mjs"
import { mkdirSync } from "node:fs"
import { join } from "node:path"
import { createRequire } from "node:module"
import { withTempDir } from "../../lib/temp-dir.mjs"

const worktree = "/work/604"
const denied = () => {
  throw Object.assign(new Error("permission denied"), { code: "EACCES" })
}

function proc(entries) {
  const values = { "/proc": Object.keys(entries) }
  for (const [pid, row] of Object.entries(entries)) {
    const root = `/proc/${pid}`
    values[root] = { uid: process.getuid() }
    values[`${root}/cmdline`] = row.cmdline ?? ""
    values[`${root}/fd`] = row.fds ?? []
    values[`${root}/cwd`] = row.cwd ?? "/"
    values[`${root}/exe`] = row.exe ?? "/usr/bin/node"
    for (const [key, value] of Object.entries(row.links ?? {}))
      values[`${root}/${key}`] = value
  }
  function read(file) {
    if (!(file in values))
      throw Object.assign(new Error("gone"), { code: "ENOENT" })
    return typeof values[file] === "function" ? values[file]() : values[file]
  }
  return {
    readdirSync: read,
    readFileSync: read,
    readlinkSync: read,
    statSync: read,
  }
}

test("unreadable systemd, ssh, gpg and empty-cmdline entries are reported without blocking unrelated worktrees", () => {
  const result = processActivity(worktree, {
    io: proc({
      1244: { cmdline: "/usr/lib/systemd/systemd\0--user", cwd: denied },
      13363: { cmdline: "/usr/bin/ssh-agent\0", fds: denied },
      1273343: { cmdline: "/usr/bin/gpg-agent\0", fds: denied },
      950643: { cmdline: "", fds: denied },
    }),
  })
  assert.equal(result.safe, true)
  assert.equal(result.warnings.length, 4)
  for (const pid of [1244, 13363, 1273343, 950643])
    assert.ok(result.warnings.some((s) => s.includes(`/proc/${pid}:`)))
})

test("readable cwd, open files and command arguments block removal despite other denied entries", () => {
  for (const row of [
    { cwd: `${worktree}/apps`, fds: denied },
    {
      cmdline: denied,
      fds: ["9"],
      links: { "fd/9": `${worktree}/output.log (deleted)` },
    },
    { cwd: denied, fds: denied, cmdline: `node\0--prefix=${worktree}/apps` },
  ]) {
    const result = processActivity(worktree, {
      io: proc({ 1244: { cwd: denied }, 9001: row }),
    })
    assert.equal(result.safe, false, JSON.stringify(row))
    assert.match(result.reason, /process 9001/)
  }
})

test("another worktree prefix and a vanished process do not block cleanup", () => {
  assert.equal(
    processActivity(worktree, {
      io: proc({
        9001: {
          cwd: "/work/604-other",
          exe: "/work/604-other/node",
          fds: ["gone"],
        },
      }),
    }).safe,
    true
  )
})

test("a missing process inventory still refuses cleanup", () => {
  const result = processActivity(worktree, { io: { readdirSync: denied } })
  assert.equal(result.safe, false)
  assert.match(result.reason, /could not list/)
})

test("the real SQLite adapter blocks a live T3 thread and allows only its terminal run", () => {
  withTempDir("cleanup-thread-", (home) => {
    const userdata = join(home, ".t3/userdata")
    const proc = join(home, "proc")
    const path = join(home, ".t3/worktrees/opencv/finished")
    mkdirSync(userdata, { recursive: true })
    mkdirSync(proc)
    const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite")
    const db = new DatabaseSync(join(userdata, "statev2.sqlite"))
    try {
      db.exec(
        "CREATE TABLE orchestration_v2_projection_threads (thread_id TEXT, payload_json TEXT); CREATE TABLE orchestration_v2_projection_runs (thread_id TEXT, ordinal INTEGER, status TEXT)"
      )
      db.prepare(
        "INSERT INTO orchestration_v2_projection_threads VALUES (?, ?)"
      ).run("thread", JSON.stringify({ worktreePath: path }))
      db.prepare(
        "INSERT INTO orchestration_v2_projection_runs VALUES (?, ?, ?)"
      ).run("thread", 1, "running")
      assert.equal(activityAdapter({ home, proc }).inspect(path).safe, false)
      db.prepare("UPDATE orchestration_v2_projection_runs SET status=?").run(
        "completed"
      )
      assert.equal(activityAdapter({ home, proc }).inspect(path).safe, true)
      assert.equal(
        activityAdapter({ home, proc }).inspect(`${path}-unknown`).safe,
        false
      )
    } finally {
      db.close()
    }
  })
})

test("a surviving task cwd blocks cleanup after its leader links disappear", () => {
  const io = proc({
    9001: {
      cwd: "gone",
      fds: [],
      links: { "task/9002/cwd": `${worktree}/apps` },
    },
  })
  const read = io.readdirSync
  io.readdirSync = (file) =>
    file === "/proc/9001/task" ? ["9001", "9002"] : read(file)
  const result = processActivity(worktree, { io })
  assert.equal(result.safe, false)
  assert.match(result.reason, /9001/)
})
