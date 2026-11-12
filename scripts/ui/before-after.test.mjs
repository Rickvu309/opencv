import assert from "node:assert/strict"
import test from "node:test"
import { join } from "node:path"
import {
  baseContext,
  baseDir,
  compareDir,
  emptyManifest,
  manifestProblems,
  prepareBase,
  pruneBases,
  recordSide,
  sideFile,
} from "./before-after.mjs"
import { fakePorts } from "./fake-ports.mjs"
import { claimPort, portClaimFile } from "./stack.mjs"

const SHA = "29c4ce33aaaabbbbcccc"

function callers() {
  const first = fakePorts({ alive: [1, 2] })
  first.git = () => SHA
  first.proc.run = async (command, args, options) => {
    if (command === "tar")
      first.store.set(join(options.cwd, "built-by.txt"), options.cwd)
    await first.clock.pause(1)
    return 0
  }
  const second = {
    ...first,
    repo: "/work/opencv.worktrees/2-other",
    pid: 2,
  }
  return { first, second }
}

test("files, the compare folder and the base checkout have fixed names away from the worktree", () => {
  assert.equal(
    sideFile("paper-panel-open", 1440, "before"),
    "paper-panel-open-1440.before.png"
  )
  assert.equal(
    compareDir("/s", "/r/opencv.worktrees/1338-x"),
    "/s/1338-x/compare"
  )
  assert.equal(
    baseDir("/s", "29c4ce33aaaabbbbcccc", "1338-x"),
    "/s/bases/29c4ce33aaaa-1338-x"
  )
})

test("the base runs from its own checkout without the worktree port", () => {
  const ctx = { repo: "/r", env: { PORT: "4338", HOME: "/h" } }
  const based = baseContext(ctx, "/s/bases/abc")
  assert.equal(based.repo, "/s/bases/abc")
  assert.deepEqual(based.env, { HOME: "/h" })
  assert.equal(ctx.env.PORT, "4338")
})

test("the manifest keeps one capture per screen and width, and names every side that failed", () => {
  const manifest = emptyManifest({
    base: "main",
    baseSha: "abc",
    head: "def",
    widths: [1440],
  })
  const screen = { id: "paper-panel-open" }
  recordSide(manifest, screen, 1440, "before", { file: "a.png", elements: [] })
  recordSide(manifest, screen, 1440, "after", { error: "step 3 failed" })
  recordSide(manifest, { id: "x" }, 390, "before", {
    error: "unreachable: no fake",
  })
  assert.equal(manifest.captures.length, 2)
  assert.deepEqual(manifest.captures[0].viewport, { width: 1440, height: 900 })
  assert.deepEqual(manifestProblems(manifest), [
    "paper-panel-open at 1440 has no after image: step 3 failed",
    "x at 390 has no before image: unreachable: no fake",
    "x at 390 has no after image: not captured",
  ])
})

test("two callers preparing the same base at once each get their own copy and keep it", async () => {
  const { first, second } = callers()
  const [a, b] = await Promise.all([
    prepareBase(first, "main"),
    prepareBase(second, "main"),
  ])
  assert.notEqual(a.dir, b.dir)
  assert.equal(first.store.get(join(a.dir, "built-by.txt")), a.dir)
  assert.equal(first.store.get(join(b.dir, "built-by.txt")), b.dir)
  assert.deepEqual(pruneBases(second).removed, [])
  assert.equal(first.store.get(join(a.dir, "built-by.txt")), a.dir)
})

test("two runs starting at once never claim the same port, and a dead run's claim is taken over", () => {
  const { first, second } = callers()
  assert.equal(claimPort(first, 4356, "/s/a"), true)
  assert.equal(claimPort(second, 4356, "/s/b"), false)
  assert.equal(claimPort(second, 4357, "/s/b"), true)
  first.store.set(
    portClaimFile(first.scratchRoot, 4358),
    JSON.stringify({ pids: [999], dir: "/s/gone" })
  )
  assert.equal(claimPort(second, 4358, "/s/b"), true)
})

test("a copy left by a crashed run is rebuilt, never reused, and pruned only once its run is gone", async () => {
  const { first } = callers()
  const dir = baseDir(first.scratchRoot, SHA, "1-demo")
  first.store.set(join(dir, "half-installed.txt"), "x")
  first.store.set(`${dir}.owner.json`, JSON.stringify({ pid: 999 }))
  const busy = baseDir(first.scratchRoot, SHA, "3-busy")
  first.store.set(join(busy, "x.txt"), "x")
  first.store.set(`${busy}.owner.json`, JSON.stringify({ pid: 2 }))
  await prepareBase(first, "main")
  assert.equal(first.store.has(join(dir, "half-installed.txt")), false)
  assert.equal(first.store.get(join(dir, "built-by.txt")), dir)
  assert.equal(JSON.parse(first.store.get(`${dir}.owner.json`)).pid, 1)
  await assert.rejects(
    prepareBase({ ...first, pid: 5 }, "main"),
    /another compare from this worktree/
  )
  first.store.set(`${dir}.owner.json`, JSON.stringify({ pid: 999 }))
  const pruned = pruneBases(first)
  assert.deepEqual(pruned.removed, [dir])
  assert.deepEqual(pruned.running, [busy])
  assert.equal(first.store.has(join(busy, "x.txt")), true)
})
