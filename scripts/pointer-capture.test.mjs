import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"
import path from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

import { missingDragEnds } from "./lib/pointer-capture.mjs"

const root = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..")

const sourceFiles = () =>
  execFileSync(
    "git",
    [
      "ls-files",
      "--cached",
      "--others",
      "--exclude-standard",
      "apps/web/src/*.ts",
      "apps/web/src/*.tsx",
      "packages/ui/src/*.ts",
      "packages/ui/src/*.tsx",
    ],
    { cwd: root, encoding: "utf8" }
  )
    .split("\n")
    .filter((file) => file && !/\.test\.tsx?$/.test(file))

const MISTAKE = `function onPointerDown(event) {
  handle.setPointerCapture(event.pointerId)
}
return <div onPointerDown={onPointerDown} onPointerMove={move} onPointerUp={end} onPointerCancel={end} />`

test("a drag that captures the pointer and never handles lost capture is a stuck drag", () => {
  assert.deepEqual(missingDragEnds(MISTAKE), ["lostpointercapture"])
})

test("a drag that captures the pointer and ends on cancel and lost capture passes", () => {
  const fixed = `${MISTAKE}\n<div onLostPointerCapture={end} />`
  assert.deepEqual(missingDragEnds(fixed), [])
})

test("a module that never captures the pointer needs no drag end", () => {
  assert.deepEqual(missingDragEnds("export const a = 1"), [])
})

test("every module that captures the pointer also ends the drag on pointercancel and lostpointercapture", () => {
  const problems = sourceFiles().flatMap((file) =>
    missingDragEnds(readFileSync(path.join(root, file), "utf8")).map(
      (name) =>
        `${file} calls setPointerCapture and never handles ${name}. A cancelled or lost pointer leaves the drag running with the cursor and text selection stuck. Add onPointerCancel and onLostPointerCapture that run the same end-of-drag code as pointerup.`
    )
  )
  assert.deepEqual(problems, [])
})
