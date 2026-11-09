import assert from "node:assert/strict"
import test from "node:test"
import { runCli } from "./cli.mjs"
import { ctxFor, fakePorts, issue, pr } from "./ports/fake.mjs"
import { threadActivity } from "./ports/activity.mjs"

const path = "/home/owner/.t3/worktrees/opencv/t3-abc"
const branch = "fix/90-finished"

function cleanup(over = {}, flags = []) {
  const ports = fakePorts({
    cwd: "/tmp/opencv",
    worktrees: [{ path, branch }],
    prs: [pr(91, { state: "MERGED", head: branch })],
    ...over,
  })
  const result = runCli(["cleanup", "--all", ...flags], ctxFor(ports))
  return {
    ports,
    result,
    removed: ports.effects.some((e) => e.op === "removeWorktree"),
  }
}

test("cleanup discovers T3 worktrees through Git, not their directory or account", () => {
  const dry = cleanup({}, ["--dry-run"])
  assert.match(dry.result.text, /would remove .*\.t3\/worktrees/)
  assert.equal(dry.removed, false)
  const real = cleanup()
  assert.equal(real.result.code, 0, real.result.text)
  assert.equal(real.removed, true)
})

test("a closed pull request requires deliberate abandonment and preserves its remote branch", () => {
  const closed = pr(91, { state: "CLOSED", head: branch })
  assert.equal(cleanup({ prs: [closed] }).removed, false)
  const marked = { ...closed, labels: [{ name: "abandoned" }] }
  const ended = cleanup({ prs: [marked], remoteBranches: [branch] })
  assert.equal(ended.removed, true, ended.result.text)
  assert.equal(
    ended.ports.effects.some((e) => e.op === "deleteRemoteBranch"),
    false
  )
  assert.equal(
    cleanup({ prs: [marked], dirty: { [path]: "?? keep.txt" } }, ["--force"])
      .removed,
    false
  )
  assert.equal(
    cleanup({ prs: [marked], relation: { [branch]: "ahead" } }).removed,
    false
  )
  assert.equal(
    cleanup({ prs: [marked], relation: { [branch]: "missing" } }).removed,
    false
  )
})

test("active threads, open PRs, human work and unpublished changes stay on disk", () => {
  assert.equal(cleanup({ activeWorktrees: [path] }, ["--force"]).removed, false)
  assert.equal(cleanup({ unpublished: [path] }, ["--force"]).removed, false)
  assert.equal(
    cleanup({
      prs: [
        pr(91, { state: "MERGED", head: branch }),
        pr(92, { head: branch }),
      ],
    }).removed,
    false
  )
  assert.equal(
    cleanup({
      prs: [
        pr(91, { state: "MERGED", head: branch, labels: ["ready-for-human"] }),
      ],
    }).removed,
    false
  )
  assert.equal(
    cleanup({ issues: [issue(90, { labels: ["ready-for-human"] })] }).removed,
    false
  )
  assert.equal(cleanup({ fetchOk: false }).removed, false)
})

test("missing and running thread state fail closed; terminal runs permit cleanup", () => {
  assert.equal(threadActivity([]).safe, false)
  assert.equal(threadActivity([{ status: "running" }]).safe, false)
  assert.equal(
    threadActivity([{ status: "completed" }, { status: null }]).safe,
    false
  )
  assert.equal(
    threadActivity([{ status: "completed" }, { status: "failed" }]).safe,
    true
  )
})

test("done reconciles a queue-completed worktree after the former account leaves", () => {
  const ports = fakePorts({
    cwd: "/tmp/opencv",
    env: { OCV_TOOLS_AGENT: "new-account-agent" },
    worktrees: [{ path, branch }],
    prs: [pr(91, { state: "MERGED", head: branch })],
  })
  const result = runCli(["done"], ctxFor(ports))
  assert.equal(result.code, 0, result.text)
  assert.equal(
    ports.effects.some((e) => e.op === "removeWorktree"),
    true
  )
})
