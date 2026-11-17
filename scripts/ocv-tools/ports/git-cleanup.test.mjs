import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { mkdirSync, symlinkSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import test from "node:test"
import { gitAdapter } from "./git.mjs"
import { isolatedEnv, realRunner } from "./proc.mjs"
import { withTempDir } from "../../lib/temp-dir.mjs"

const scratchEnv = () => isolatedEnv(process.env)

test("cleanup retains advanced remote tips and a concurrent push defeats its deletion lease", () => {
  withTempDir("cleanup-remote-", (root) => {
    const sh = (cwd, args, input) =>
      execFileSync("git", args, {
        cwd,
        env: scratchEnv(),
        input,
        encoding: "utf8",
        timeout: 5000,
        maxBuffer: 1024 * 1024,
      }).trim()
    const source = fileURLToPath(new URL("../../../", import.meta.url))
    sh(root, [
      "clone",
      "--no-hardlinks",
      "--quiet",
      "--bare",
      "--shared",
      source,
      "origin.git",
    ])
    sh(root, [
      "clone",
      "--no-hardlinks",
      "--quiet",
      "--shared",
      "--no-checkout",
      "origin.git",
      "work",
    ])
    const cwd = join(root, "work")
    const origin = join(root, "origin.git")
    const a = sh(source, ["rev-parse", "HEAD^"])
    const b = sh(source, ["rev-parse", "HEAD"])
    sh(origin, ["update-ref", "refs/heads/main", a])
    sh(cwd, ["update-ref", "refs/heads/main", a])
    sh(cwd, ["push", "--quiet", "origin", "main"])
    const branch = "fix/90-retained"
    sh(cwd, ["push", "--quiet", "origin", `${a}:refs/heads/${branch}`])
    const git = gitAdapter(realRunner())
    const observed = git.retainedRemote(cwd, branch, [a])
    assert.deepEqual(observed, { oid: a, retained: true })
    sh(cwd, ["push", "--quiet", "origin", `${b}:refs/heads/${branch}`])
    assert.deepEqual(git.retainedRemote(cwd, branch, [a]), {
      oid: b,
      retained: false,
    })
    assert.equal(git.deleteRemoteBranch(cwd, branch, observed.oid).ok, false)
    assert.equal(sh(origin, ["rev-parse", `refs/heads/${branch}`]), b)
    sh(origin, ["update-ref", `refs/heads/${branch}`, a, b])
    assert.equal(git.deleteRemoteBranch(cwd, branch, observed.oid).ok, true)
    assert.deepEqual(git.retainedRemote(cwd, branch, [a]), {
      oid: null,
      retained: true,
    })
    const sub = join(cwd, "src")
    mkdirSync(sub)
    symlinkSync(sub, join(root, "alias"))
    assert.equal(git.here(join(root, "alias")).top, cwd)
  })
})
