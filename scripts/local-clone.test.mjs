import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"
import test from "node:test"
import { detect } from "./lib/local-clone.mjs"

const clone = (...args) =>
  `git(${["cl" + "one", ...args].map((arg) => JSON.stringify(arg)).join(", ")})`

test("local test clones disable hard links across filesystems", () => {
  const files = execFileSync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard", "scripts"],
    { encoding: "utf8" }
  )
    .trim()
    .split("\n")
  const hits = files.flatMap((file) =>
    detect(readFileSync(file, "utf8"), file).map((line) => `${file}:${line}`)
  )
  assert.deepEqual(
    hits,
    [],
    "Local test clones must use --no-hardlinks: " + hits.join(", ")
  )
})

test("the detector catches local clones and permits copying and remote transports", () => {
  assert.deepEqual(detect(clone("--local", "root", "clone")), [1])
  assert.deepEqual(detect(clone("root", "clone")), [1])
  assert.deepEqual(detect(clone("--no-hardlinks", "root", "clone")), [])
  assert.deepEqual(detect(clone("--no-local", "root", "clone")), [])
  assert.deepEqual(detect(clone("https://example.com/repo", "clone")), [])
  assert.deepEqual(detect(clone("root", "clone"), "notes.mjs"), [])
  assert.deepEqual(detect('const clone = join(root, "clone")'), [])
})
