import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { readFileSync, writeFileSync } from "node:fs"
import { homedir } from "node:os"
import path from "node:path"
import test from "node:test"
import ts from "typescript"

import { detect, mutate } from "./lib/paper-save.mjs"
import { withTempDir } from "./lib/temp-dir.mjs"

const implementation = readFileSync(
  new URL("../packages/domain/src/paper-save.ts", import.meta.url),
  "utf8"
)
const replay = readFileSync(
  new URL("../packages/domain/src/paper-save.test.ts", import.meta.url),
  "utf8"
)
const compile = (source) =>
  ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
    },
  }).outputText
const childEnv = { ...process.env }
delete childEnv.NODE_TEST_CONTEXT

test("receipt identity is a mistake and value comparison stays quiet", () => {
  const mistake =
    "export function canShowSaved(state, head, receipt) { return state.receipts.get(receipt.id) === receipt }"
  const clean =
    "export function canShowSaved(state, head, receipt) { return state.receipts.get(receipt.id)?.hash === receipt.hash }"
  assert.equal(detect(mistake).length, 1)
  assert.deepEqual(detect(clean), [])
  assert.deepEqual(detect(implementation), [])
})

for (const fault of ["saved", "expiry"]) {
  test(`the replay rejects the ${fault} source mutant and passes after restoration`, () => {
    const broken = mutate(implementation, fault)
    assert.ok(detect(broken).length > 0)
    withTempDir(
      "paper-save-",
      (dir) => {
        writeFileSync(path.join(dir, "package.json"), '{"type":"module"}')
        writeFileSync(path.join(dir, "paper-save.test.js"), compile(replay))
        const run = (source) => {
          writeFileSync(path.join(dir, "paper-save.js"), compile(source))
          return spawnSync(process.execPath, ["--test", "paper-save.test.js"], {
            cwd: dir,
            encoding: "utf8",
            timeout: 30_000,
            env: childEnv,
          })
        }
        const before = run(implementation)
        assert.equal(before.status, 0, before.stdout + before.stderr)
        const mutant = run(broken)
        assert.equal(mutant.status, 1, mutant.stdout + mutant.stderr)
        assert.match(mutant.stdout + mutant.stderr, /ERR_ASSERTION/)
        assert.match(
          mutant.stdout + mutant.stderr,
          fault === "saved" ? /true !== false/ : /Missing expected exception/
        )
        const restored = run(implementation)
        assert.equal(restored.status, 0, restored.stdout + restored.stderr)
      },
      path.join(homedir(), "tmp")
    )
  })
}
