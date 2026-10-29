import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"
import { runCli } from "./cli.mjs"
import { claimMarker } from "./claim-marker.mjs"
import { realRun } from "./core.mjs"
import { fakeCtx, issueData, minutesAgo, tempClone } from "./fake-ctx.mjs"

const claim = (agent, minutes) => ({
  databaseId: 7,
  body: claimMarker({ agent, at: minutesAgo(minutes), branch: "feat/90-x" }),
})
const ghRules = (comments) => [
  ["repo view", '{"owner":{"login":"owner"},"name":"opencv"}'],
  ["api graphql", issueData({ comments: { nodes: comments } })],
  ["api -X PATCH", ""],
]

// A real temp repo with a bare origin; only gh is faked.
function tempRepo(comments, env = { OCV_TOOLS_AGENT: "me" }) {
  const root = mkdtempSync(join(tmpdir(), "ocv-tools-test-"))
  const sh = (cwd, ...a) => execFileSync("git", a, { cwd, encoding: "utf8" })
  sh(root, "init", "--bare", "-b", "main", "origin.git")
  sh(root, "clone", "-q", "origin.git", "work")
  const work = join(root, "work")
  for (const [k, v] of [
    ["user.name", "t"],
    ["user.email", "t@example.com"],
    ["core.hooksPath", "/dev/null"],
  ])
    sh(work, "config", k, v)
  writeFileSync(join(work, "a.txt"), "a\n")
  sh(work, "add", "-A")
  sh(work, "commit", "-q", "-m", "init")
  sh(work, "push", "-q", "origin", "main")
  sh(work, "checkout", "-q", "-b", "feat/90-keep-my-search")
  const calls = []
  const fake = fakeCtx(ghRules(comments), { env })
  const ctx = {
    ...fake,
    cwd: work,
    run: (cmd, args, options) => {
      if (cmd === "gh") return fake.run(cmd, args)
      calls.push(`${cmd} ${args.join(" ")}`)
      return realRun(cmd, args, options)
    },
    ghCalls: fake.calls,
  }
  return {
    ctx,
    work,
    root,
    sh,
    done: () => rmSync(root, { recursive: true, force: true }),
  }
}

test("save commits with the issue suffix, pushes and refreshes the single claim comment", () => {
  const t = tempRepo([claim("me", 100)])
  try {
    writeFileSync(join(t.work, "b.txt"), "b\n")
    const r = runCli(["save", "-m", "feat: add b"], t.ctx)
    assert.equal(r.code, 0, r.text)
    assert.equal(
      t.sh(t.work, "log", "-1", "--format=%s"),
      "feat: add b (#90)\n"
    )
    assert.match(
      t.sh(t.work, "ls-remote", "--heads", "origin"),
      /feat\/90-keep-my-search/
    )
    const patch = t.ctx.ghCalls.find((c) =>
      c.includes("api -X PATCH repos/{owner}/{repo}/issues/comments/7")
    )
    assert.match(
      patch,
      /claim agent=me at=2026-10-29T12:00:00.000Z branch=feat\/90-x/
    )
    // a message that already names the issue is kept; nothing left to save refreshes only
    const again = runCli(["save", "-m", "x (#90)"], t.ctx)
    assert.match(again.text, /Nothing to save/)
    assert.equal(again.code, 0)
    writeFileSync(join(t.work, "c.txt"), "c\n")
    runCli(["save", "-m", "feat: add c (#90)"], t.ctx)
    assert.equal(
      t.sh(t.work, "log", "-1", "--format=%s"),
      "feat: add c (#90)\n"
    )
  } finally {
    t.done()
  }
})

test("save by an agent that lost the claim exits 3 and writes a patch", () => {
  const t = tempRepo([claim("me", 400), claim("other", 5)])
  try {
    writeFileSync(join(t.work, "b.txt"), "lost work\n")
    const r = runCli(["save", "-m", "feat: add b"], t.ctx)
    assert.equal(r.code, 3)
    assert.match(r.text, /LOST #90: other holds the claim now/)
    assert.match(
      r.text,
      /patch: \/tmp\/lost\/90-2026-10-29T12-00-00-000Z\.patch/
    )
    assert.match(
      t.ctx.written["lost/90-2026-10-29T12-00-00-000Z.patch"],
      /lost work/
    )
    assert.equal(t.sh(t.work, "log", "-1", "--format=%s"), "init\n")
    assert.ok(!t.ctx.ghCalls.some((c) => c.includes("PATCH")))
  } finally {
    t.done()
  }
})

test("save with no agent id, outside a task and without -m is refused plainly", () => {
  const t = tempRepo([claim("me", 5)], {})
  try {
    assert.equal(runCli(["save", "-m", "x"], t.ctx).code, 3)
    assert.equal(runCli(["save"], t.ctx).code, 1)
    t.sh(t.work, "checkout", "-q", "main")
    const r = runCli(["save", "-m", "x"], t.ctx)
    assert.match(r.text, /REFUSED NOT_A_TASK/)
  } finally {
    t.done()
  }
})

function cleanupCtx(t, prs) {
  const fake = fakeCtx([["pr list", prs]])
  return {
    ...fake,
    cwd: t.work,
    run: (cmd, args, options) =>
      cmd === "gh" ? fake.run(cmd, args) : realRun(cmd, args, options),
  }
}

function withTaskWorktree(fn) {
  const t = tempClone()
  try {
    const wt = join(t.root, "opencv.worktrees", "90-keep")
    t.sh(t.work, "worktree", "add", "-q", "-b", "feat/90-keep", wt, "main")
    fn(t, wt)
  } finally {
    t.done()
  }
}

test("cleanup refuses unsaved work and an unmerged pull request, then lists what it removed", () => {
  withTaskWorktree((t, wt) => {
    writeFileSync(join(wt, "x.txt"), "x")
    const dirty = runCli(["cleanup", "90"], cleanupCtx(t, "[]"))
    assert.equal(dirty.code, 2)
    assert.match(dirty.text, /REFUSED DIRTY.*x\.txt/s)
    rmSync(join(wt, "x.txt"))
    const open = runCli(["cleanup", "#90"], cleanupCtx(t, "[]"))
    assert.match(open.text, /REFUSED NOT_MERGED/)
    assert.ok(existsSync(wt))
    const dry = runCli(
      ["cleanup", "90", "--dry-run"],
      cleanupCtx(t, '[{"number":5}]')
    )
    assert.match(dry.text, /would remove .*90-keep/)
    assert.ok(existsSync(wt))
    const ok = runCli(["cleanup", "90"], cleanupCtx(t, '[{"number":5}]'))
    assert.equal(ok.code, 0, ok.text)
    assert.match(ok.text, /Removed:\n {2}.*90-keep {2}\(feat\/90-keep\)/)
    assert.ok(!existsSync(wt))
    assert.equal(t.sh(t.work, "branch", "--list", "feat/90-keep"), "")
    const none = runCli(["cleanup", "90"], cleanupCtx(t, "[]"))
    assert.match(none.text, /REFUSED NO_WORKTREE/)
  })
})

test("cleanup from inside the worktree infers the issue; --force removes unsaved work; --all keeps unmerged", () => {
  withTaskWorktree((t, wt) => {
    writeFileSync(join(wt, "x.txt"), "x")
    const inside = { ...cleanupCtx(t, '[{"number":5}]'), cwd: wt }
    assert.match(runCli(["cleanup"], inside).text, /REFUSED DIRTY/)
    const all = runCli(["cleanup", "--all"], cleanupCtx(t, "[]"))
    assert.match(all.text, /kept feat\/90-keep: .*no merged/)
    const forced = runCli(["cleanup", "--force"], inside)
    assert.equal(forced.code, 0, forced.text)
    assert.ok(!existsSync(wt))
  })
})
