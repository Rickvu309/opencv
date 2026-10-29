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

const claim = (agent, minutes, id = 7) => ({
  databaseId: id,
  createdAt: minutesAgo(minutes),
  updatedAt: minutesAgo(minutes),
  body: claimMarker({ agent, at: "client", branch: "feat/90-x" }),
})
const ghRules = (comments) => [
  ["repo view", '{"owner":{"login":"owner"},"name":"opencv"}'],
  [
    "api graphql",
    () => ({
      ok: true,
      out: issueData({ comments: { nodes: comments } }),
      err: "",
    }),
  ],
  ["-X PATCH", '{"updated_at":"2026-10-29T12:00:05Z"}'],
]

// A linked task worktree under opencv.worktrees, with a bare origin. Only gh is faked.
function tempRepo(comments, env = { OCV_TOOLS_AGENT: "me" }, seed) {
  const root = mkdtempSync(join(tmpdir(), "ocv-tools-test-"))
  const sh = (cwd, ...a) => execFileSync("git", a, { cwd, encoding: "utf8" })
  sh(root, "init", "--bare", "-b", "main", "origin.git")
  sh(root, "clone", "-q", "origin.git", "opencv")
  const main = join(root, "opencv")
  for (const [k, v] of [
    ["user.name", "t"],
    ["user.email", "t@example.com"],
    ["core.hooksPath", "/dev/null"],
  ])
    sh(main, "config", k, v)
  writeFileSync(join(main, "a.txt"), "a\n")
  if (seed) seed(main)
  sh(main, "add", "-A")
  sh(main, "commit", "-q", "-m", "init")
  sh(main, "push", "-q", "origin", "main")
  const work = join(root, "opencv.worktrees", "90-keep-my-search")
  sh(
    main,
    "worktree",
    "add",
    "-q",
    "-b",
    "feat/90-keep-my-search",
    work,
    "main"
  )
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
    main,
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
      c.includes("-X PATCH repos/{owner}/{repo}/issues/comments/7")
    )
    assert.match(
      patch,
      /claim agent=me at=2026-10-29T10:20:00.000Z branch=feat\/90-x/
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
    t.sh(t.work, "checkout", "-q", "-b", "scratch")
    const r = runCli(["save", "-m", "x"], t.ctx)
    assert.match(r.text, /REFUSED NOT_A_TASK/)
  } finally {
    t.done()
  }
})

test("a LOST patch applies, including a blank context line and a binary file", () => {
  const t = tempRepo([claim("other", 1)], { OCV_TOOLS_AGENT: "me" }, (main) => {
    writeFileSync(join(main, "blank.txt"), "old\n\n")
    writeFileSync(join(main, "pic.bin"), Buffer.from([0, 1, 2, 255, 10]))
  })
  try {
    writeFileSync(join(t.work, "blank.txt"), "new\n\n")
    writeFileSync(join(t.work, "pic.bin"), Buffer.from([0, 1, 9, 255, 10]))
    const r = runCli(["save", "-m", "feat: edit blank"], t.ctx)
    assert.equal(r.code, 3, r.text)
    const name = "lost/90-2026-10-29T12-00-00-000Z.patch"
    const patch = t.ctx.written[name]
    assert.ok(patch.split("\n").includes(" "))
    const dst = join(t.root, "apply")
    t.sh(t.root, "clone", "-q", join(t.root, "origin.git"), "apply")
    writeFileSync(join(dst, "lost.patch"), patch)
    t.sh(dst, "apply", "--check", "lost.patch")
  } finally {
    t.done()
  }
})

test("LOST does not claim the work was saved when git add or diff fails", () => {
  const rules = [
    ["rev-parse --show-toplevel", "/repo.worktrees/90-keep-my-search"],
    ["rev-parse --abbrev-ref", "feat/90-keep-my-search"],
    ["rev-parse --absolute-git-dir", "/repo/.git/worktrees/90-keep"],
    ["rev-parse --path-format=absolute --git-common-dir", "/repo/.git"],
    ["repo view", '{"owner":{"login":"owner"},"name":"opencv"}'],
    [
      "api graphql",
      () => ({
        ok: true,
        out: issueData({ comments: { nodes: [claim("other", 1, 8)] } }),
        err: "",
      }),
    ],
  ]
  const add = fakeCtx(
    [...rules, ["add -A", () => ({ ok: false, out: "", err: "add broke" })]],
    { env: { OCV_TOOLS_AGENT: "me" } }
  )
  const added = runCli(["save", "-m", "feat: x"], add)
  assert.equal(added.code, 1)
  assert.match(added.text, /git add failed: add broke/)
  assert.equal(add.written["lost/90-2026-10-29T12-00-00-000Z.patch"], undefined)

  const diff = fakeCtx(
    [
      ...rules,
      ["add -A", ""],
      [
        "diff --cached --binary",
        () => ({ ok: false, out: "", err: "diff broke" }),
      ],
    ],
    { env: { OCV_TOOLS_AGENT: "me" } }
  )
  const differed = runCli(["save", "-m", "feat: x"], diff)
  assert.equal(differed.code, 1)
  assert.match(differed.text, /git diff failed: diff broke/)
})

test("save refuses a normal clone and a worktree outside the worktree root", () => {
  const t = tempRepo([claim("me", 5)])
  try {
    t.sh(t.main, "checkout", "-q", "-b", "feat/91-not-linked")
    writeFileSync(join(t.main, "sneak.txt"), "x\n")
    const clone = runCli(["save", "-m", "feat: sneak"], {
      ...t.ctx,
      cwd: t.main,
    })
    assert.match(clone.text, /REFUSED NOT_A_TASK/)
    assert.equal(t.sh(t.main, "log", "-1", "--format=%s"), "init\n")
    assert.match(t.sh(t.main, "status", "--porcelain"), /sneak\.txt/)

    const outside = join(t.root, "elsewhere")
    t.sh(
      t.main,
      "worktree",
      "add",
      "-q",
      "-b",
      "feat/92-outside-here",
      outside,
      "main"
    )
    const out = runCli(["save", "-m", "feat: no"], { ...t.ctx, cwd: outside })
    assert.match(out.text, /REFUSED NOT_A_TASK/)
    assert.equal(t.sh(outside, "log", "-1", "--format=%s"), "init\n")
  } finally {
    t.done()
  }
})

test("save does not push when another agent takes the claim before the push", () => {
  const comments = [claim("me", 10)]
  const t = tempRepo(comments)
  try {
    const orig = t.ctx.run
    t.ctx.run = (cmd, args, options) => {
      const r = orig(cmd, args, options)
      if (cmd === "git" && args[0] === "commit")
        comments.push(claim("other", 1, 8))
      return r
    }
    writeFileSync(join(t.work, "b.txt"), "b\n")
    const r = runCli(["save", "-m", "feat: add b"], t.ctx)
    assert.equal(r.code, 3, r.text)
    assert.match(r.text, /LOST #90: other holds/)
    assert.match(t.sh(t.work, "log", "-1", "--format=%s"), /add b/)
    assert.doesNotMatch(
      t.sh(t.work, "ls-remote", "--heads", "origin"),
      /feat\/90/
    )
    assert.ok(!t.ctx.ghCalls.some((c) => c.includes("PATCH")))
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
