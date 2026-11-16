import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { execFileSync } from "node:child_process"
import test from "node:test"
import { detect } from "./lib/paper-print-cancel.mjs"

test("cleanup must cancel without completing the caller", () => {
  assert.deepEqual(
    detect(
      "function printPaper(title, onDone) { const finish = () => { abort(); onDone?.() }; return finish }"
    ),
    ["Print cleanup completes the caller"]
  )
  assert.deepEqual(
    detect(
      "function printPaper(title, onDone) { const cancel = () => abort(); const finish = () => { cancel(); onDone?.() }; cancelActivePrint = finish; return cancel }"
    ),
    []
  )
  assert.deepEqual(
    detect(
      "function printPaper(title, onDone) { const finish = () => onDone?.(); return () => finish() }"
    ),
    ["Print cleanup completes the caller"]
  )
})

test("rejects the PR introducing commit 879f871a", () => {
  const text = execFileSync(
    "git",
    ["show", "879f871a:apps/web/src/features/paper/paper-print.ts"],
    { encoding: "utf8" }
  )
  assert.deepEqual(detect(text), ["Print cleanup completes the caller"])
})

test("the current print cleanup never completes the caller", () => {
  assert.deepEqual(
    detect(
      readFileSync(
        new URL(
          "../apps/web/src/features/paper/paper-print.ts",
          import.meta.url
        ),
        "utf8"
      )
    ),
    []
  )
})
