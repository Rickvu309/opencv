import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

import { detect } from "./lib/toast-position.mjs"

const root = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..")

const webFiles = () =>
  execFileSync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard", "apps/web/src"],
    { cwd: root, encoding: "utf8" }
  )
    .split("\n")
    .filter((file) => /\.tsx?$/.test(file) && !/\.test\.tsx?$/.test(file))
    .filter((file) => existsSync(path.join(root, file)))

test("a toast that picks its own position fires", () => {
  const found =
    detect(`if (created.notice) toast(created.notice, { position: "top-center" })
toast.error("Could not save", { position: "top-right", duration: 4000 })`)
  assert.deepEqual(
    found.map((item) => item.line),
    [1, 2]
  )
})

test("a toast that leaves its place to the shared rule stays quiet", () => {
  assert.deepEqual(
    detect(`toast(created.notice)
toast.error("Could not save", { duration: 4000 })
const position = { position: "top" }`),
    []
  )
})

test("no toast in the web app picks its own position", () => {
  const problems = webFiles().flatMap((file) =>
    detect(readFileSync(path.join(root, file), "utf8"), file).map(
      (item) => `${file}:${item.line} ${item.why}`
    )
  )
  assert.deepEqual(problems, [])
})
