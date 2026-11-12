import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { join, resolve } from "node:path"
import test from "node:test"
import { gitAdapter } from "./git.mjs"
import { realRunner } from "./proc.mjs"
import { makeTempDir } from "../../lib/temp-dir.mjs"
import { GIT_ENV } from "../jobs/push-checks.mjs"

const scratchEnv = () => {
  const env = { ...process.env }
  for (const name of GIT_ENV) delete env[name]
  return env
}

function tempClone() {
  const root = makeTempDir("ocv-tools-git-")
  const sh = (cwd, ...args) =>
    execFileSync("git", args, { cwd, env: scratchEnv(), encoding: "utf8" })
  sh(root, "init", "-q", "--bare", "-b", "main", "origin.git")
  sh(root, "clone", "-q", "origin.git", "opencv")
  const work = join(root, "opencv")
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
  return {
    root,
    work,
    sh,
    git: gitAdapter(realRunner()),
    done: () => rmSync(root, { recursive: true, force: true }),
  }
}

test("worktrees, here, add, track and remove use one parser", () => {
  const t = tempClone()
  try {
    const branch = "feat/90-keep-my-search"
    t.sh(t.work, "checkout", "-q", "-b", branch)
    writeFileSync(join(t.work, "kept.txt"), "kept\n")
    t.sh(t.work, "add", "kept.txt")
    t.sh(t.work, "commit", "-q", "-m", "kept")
    t.sh(t.work, "push", "-q", "-u", "origin", branch)
    t.sh(t.work, "checkout", "-q", "main")
    t.sh(t.work, "branch", "-D", branch)
    const mainHere = t.git.here(t.work)
    assert.equal(resolve(mainHere.gitDir), resolve(mainHere.common))
    mkdirSync(join(t.root, "opencv.worktrees"))
    const tracked = join(t.root, "opencv.worktrees", "90-keep-my-search")
    const added = t.git.addWorktree(t.work, {
      path: tracked,
      branch,
      mode: "track",
      start: `origin/${branch}`,
    })
    assert.equal(added.ok, true, added.err)
    assert.equal(readFileSync(join(tracked, "kept.txt"), "utf8"), "kept\n")
    const linked = t.git.here(tracked)
    assert.notEqual(resolve(linked.gitDir), resolve(linked.common))
    assert.equal(linked.branch, branch)
    assert.equal(
      added.gitDir,
      t.sh(tracked, "rev-parse", "--absolute-git-dir").trim()
    )
    const listed = t.git.worktrees(t.work)
    assert.ok(listed.some((w) => w.path === tracked && w.branch === branch))
    assert.ok(listed.every((w) => !w.branch.includes("refs/heads/")))
    const fresh = join(t.root, "opencv.worktrees", "2-new-one")
    const created = t.git.addWorktree(t.work, {
      path: fresh,
      branch: "feat/2-new-one-here",
      mode: "new",
      start: "origin/main",
    })
    assert.equal(created.ok, true, created.err)
    assert.equal(
      t.sh(fresh, "rev-parse", "--abbrev-ref", "HEAD").trim(),
      "feat/2-new-one-here"
    )
    assert.equal(
      t.sh(fresh, "rev-parse", "HEAD").trim(),
      t.sh(t.work, "rev-parse", "origin/main").trim()
    )
    assert.equal(t.git.removeWorktree(t.work, tracked, true).ok, true)
    assert.equal(t.git.deleteBranch(t.work, branch).ok, true)
    assert.equal(existsSync(tracked), false)
    assert.equal(t.sh(t.work, "branch", "--list", branch), "")
  } finally {
    t.done()
  }
})

test("branchFacts reports same, behind, ahead and diverged, and fast-forward moves only the local tip", () => {
  const t = tempClone()
  try {
    const branch = "feat/90-keep-my-search"
    t.sh(t.work, "checkout", "-q", "-b", branch)
    writeFileSync(join(t.work, "kept.txt"), "base\n")
    t.sh(t.work, "add", "kept.txt")
    t.sh(t.work, "commit", "-q", "-m", "base")
    t.sh(t.work, "push", "-q", "-u", "origin", branch)
    assert.equal(t.git.branchFacts(t.work, branch).relation, "same")
    writeFileSync(join(t.work, "kept.txt"), "remote\n")
    t.sh(t.work, "add", "kept.txt")
    t.sh(t.work, "commit", "-q", "-m", "remote tip")
    t.sh(t.work, "push", "-q", "origin", branch)
    t.sh(t.work, "reset", "--hard", "HEAD~1")
    const behind = t.git.branchFacts(t.work, branch)
    assert.equal(behind.relation, "behind")
    assert.equal(t.git.fastForward(t.work, branch, behind.remote).ok, true)
    assert.equal(t.git.branchFacts(t.work, branch).relation, "same")
    assert.match(t.sh(t.work, "log", "-1", "--format=%s", branch), /remote tip/)
    writeFileSync(join(t.work, "kept.txt"), "local\n")
    t.sh(t.work, "commit", "-aq", "-m", "local only")
    assert.equal(t.git.branchFacts(t.work, branch).relation, "ahead")
    t.sh(t.work, "reset", "--hard", "HEAD~1")
    t.sh(t.work, "checkout", "-q", "--detach", "HEAD")
    writeFileSync(join(t.work, "kept.txt"), "local\n")
    t.sh(t.work, "commit", "-aq", "-m", "local only")
    const localTip = t.sh(t.work, "rev-parse", "HEAD").trim()
    t.sh(t.work, "checkout", "-q", "--detach", "HEAD~1")
    writeFileSync(join(t.work, "kept.txt"), "remote-only\n")
    t.sh(t.work, "commit", "-aq", "-m", "remote only")
    t.sh(t.work, "push", "-q", "origin", `HEAD:${branch}`)
    t.sh(t.work, "branch", "-f", branch, localTip)
    t.sh(t.work, "checkout", "-q", "main")
    assert.equal(t.git.branchFacts(t.work, branch).relation, "diverged")
    assert.match(t.sh(t.work, "log", "-1", "--format=%s", branch), /local only/)
    const remoteRef = `refs/remotes/origin/${branch}`
    t.sh(t.work, "update-ref", "-d", remoteRef)
    assert.equal(t.git.remoteHead(t.work, branch), true)
    assert.equal(t.git.branchFacts(t.work, branch).relation, "missing")
  } finally {
    t.done()
  }
})

test("diffCached keeps a blank context line and a binary hunk that applies", () => {
  const t = tempClone()
  try {
    writeFileSync(join(t.work, "blank.txt"), "old\n\n")
    writeFileSync(join(t.work, "pic.bin"), Buffer.from([0, 1, 2, 255, 10]))
    t.sh(t.work, "add", "-A")
    t.sh(t.work, "commit", "-q", "-m", "files")
    t.sh(t.work, "push", "-q", "origin", "main")
    writeFileSync(join(t.work, "blank.txt"), "new\n\n")
    writeFileSync(join(t.work, "pic.bin"), Buffer.from([0, 1, 9, 255, 10]))
    t.sh(t.work, "add", "-A")
    const raw = execFileSync(
      "git",
      ["diff", "--cached", "--binary", "origin/main"],
      { cwd: t.work, encoding: "utf8" }
    )
    const diff = t.git.diffCached(t.work, "origin/main")
    assert.equal(diff.ok, true)
    assert.equal(diff.out, raw)
    assert.ok(diff.out.split("\n").includes(" "))
    const dst = join(t.root, "apply")
    t.sh(t.root, "clone", "-q", join(t.root, "origin.git"), "apply")
    writeFileSync(join(dst, "lost.patch"), diff.out)
    t.sh(dst, "apply", "--check", "lost.patch")
  } finally {
    t.done()
  }
})
