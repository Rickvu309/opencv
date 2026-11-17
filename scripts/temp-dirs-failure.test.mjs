import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import test from "node:test"
import { detect, canJudgeFolders } from "./lib/temp-run.mjs"
import { failedGuards } from "./lib/test-failures.mjs"
import { tempDir } from "./lib/temp-dir.mjs"
import { fixture } from "./ocv-tools/jobs/fixture.mjs"

const name = "protected branch rejects removed assertions"
const message =
  "PROTECTED_WEAKENED: removed 16 assertions: scripts/example.test.mjs"

const innerHead =
  'import test from "node:test"\nimport assert from "node:assert/strict"\n'
const brokenInner =
  innerHead +
  'test("protected branch rejects removed assertions", () => { assert.deepEqual(["PROTECTED_WEAKENED: removed 16 assertions: scripts/example.test.mjs"], []) })\n'
const cleanInner =
  innerHead +
  'test("protected branch rejects removed assertions", () => { assert.ok(true) })\n'

test("an inner failure is named in the folder skip and merge refusal, while a clean run stays quiet", (t) => {
  const dir = tempDir(t, "temp-failure-")
  const file = join(dir, "inner.test.mjs")
  const { NODE_TEST_CONTEXT: _outer, ...env } = process.env
  for (const broken of [true, false]) {
    writeFileSync(file, broken ? brokenInner : cleanInner)
    const run = spawnSync(
      process.execPath,
      ["--test", "--test-reporter=spec", file],
      { env, encoding: "utf8", timeout: 60_000 }
    )
    assert.equal(run.status, broken ? 1 : 0, run.stderr)
    const skips = []
    assert.equal(
      canJudgeFolders({ skip: (reason) => skips.push(reason) }, run),
      !broken
    )
    const failures = failedGuards({
      ok: run.status === 0,
      out: run.stdout,
      err: run.stderr,
    })
    if (!broken) {
      assert.deepEqual(skips, [])
      assert.deepEqual(failures, [])
      continue
    }
    assert.equal(skips.length, 1)
    assert.ok(skips[0].includes(name) && skips[0].includes(message), skips[0])
    assert.equal(failures.length, 1)
    assert.ok(
      failures[0].startsWith(`${name}: AssertionError [ERR_ASSERTION]:`)
    )
    assert.ok(failures[0].includes(message), failures[0])
    const f = fixture({ behind: 1, guardOutput: run.stdout })
    const refusal = f.call("merge", "91")
    assert.equal(refusal.code, 2, refusal.text)
    assert.match(refusal.text, /MERGED_TREE_FAILS/)
    assert.ok(refusal.text.includes(failures[0]), refusal.text)
    assert.doesNotMatch(refusal.text, /leave no temporary folder behind/)
    assert.equal(f.effects("gh", "pr merge").length, 0)
    t.diagnostic(refusal.text)
  }
})

test("the inner-run status assertion is caught and the folder-only guard stays quiet", () => {
  assert.deepEqual(detect("assert.equal(run.status, 0, run.stdout)"), [1])
  assert.deepEqual(detect("if (!canJudgeFolders(t, run)) return"), [])
  assert.deepEqual(
    detect(
      readFileSync(new URL("./temp-dirs.test.mjs", import.meta.url), "utf8")
    ),
    []
  )
})
