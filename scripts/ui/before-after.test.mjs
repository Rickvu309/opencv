import assert from "node:assert/strict"
import test from "node:test"
import {
  baseContext,
  baseDir,
  compareDir,
  emptyManifest,
  manifestProblems,
  recordSide,
  sideFile,
} from "./before-after.mjs"

test("files, the compare folder and the base checkout have fixed names away from the worktree", () => {
  assert.equal(
    sideFile("paper-panel-open", 1440, "before"),
    "paper-panel-open-1440.before.png"
  )
  assert.equal(
    compareDir("/s", "/r/opencv.worktrees/1338-x"),
    "/s/1338-x/compare"
  )
  assert.equal(baseDir("/s", "29c4ce33aaaabbbbcccc"), "/s/bases/29c4ce33aaaa")
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
