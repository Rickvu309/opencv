import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"
import path from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

import { smallTargets } from "./lib/touch-targets.mjs"

const root = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..")
const pending = JSON.parse(
  readFileSync(path.join(root, "apps/web/src/test/nav-pending.json"), "utf8")
).filter((entry) => entry.rule === "touch-targets")

const featureFiles = () =>
  execFileSync(
    "git",
    [
      "ls-files",
      "--cached",
      "--others",
      "--exclude-standard",
      "apps/web/src/features",
    ],
    { cwd: root, encoding: "utf8" }
  )
    .split("\n")
    .filter((file) => file.endsWith(".tsx") && !file.endsWith(".test.tsx"))

const MISTAKE = `const row = "flex h-7 items-center rounded-md px-2 hover:bg-sidebar-accent"
export const menu = <Button size="icon-sm" aria-label="Menu" />`

test("a nav row or icon button that is 28px tall on a phone is a small target", () => {
  assert.equal(smallTargets(MISTAKE).length, 2)
})

test("a nav row or icon button that is 44px on a phone and 28px on desktop passes", () => {
  const fixed = `const row = "flex h-11 items-center rounded-md px-2 hover:bg-sidebar-accent md:h-7"
export const menu = <Button size="icon-sm" className="size-11 md:size-7" aria-label="Menu" />`
  assert.deepEqual(smallTargets(fixed), [])
})

test("a non-interactive 28px block is not a target", () => {
  assert.deepEqual(smallTargets('const a = "mx-2 mt-3 h-7"'), [])
})

test("every interactive control in features is 44px on a phone", () => {
  const problems = featureFiles().flatMap((file) => {
    const found = smallTargets(
      readFileSync(path.join(root, file), "utf8"),
      file
    )
    const entry = pending.find((item) => item.file === file)
    if (entry) {
      assert.ok(
        found.length > 0,
        `${file} no longer has a small target. Remove its touch-targets entry from apps/web/src/test/nav-pending.json.`
      )
      return []
    }
    return found.map(
      (item) =>
        `${file}:${item.line} ${item.why}. A phone target is at least 44px; keep the desktop size behind md:.`
    )
  })
  assert.deepEqual(problems, [])
})
