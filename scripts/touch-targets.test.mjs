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

export function pinnedCountProblems(file, found, pinned) {
  if (found === 0)
    return `${file} no longer has a small target. Remove its touch-targets entry from apps/web/src/test/nav-pending.json.`
  if (!Number.isInteger(pinned) || pinned < 1)
    return `${file} is pending with no count. Pin ${found}.`
  if (found > pinned)
    return `${file} has ${found} small targets but the list allows ${pinned}. The list only shrinks.`
  if (found < pinned)
    return `${file} has ${found} small targets. Lower its pinned count from ${pinned} to ${found}.`
  return ""
}

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

test("a pending file can only shrink its pinned small-target count", () => {
  const file = "apps/web/src/features/apply/apply-board.tsx"
  assert.equal(pinnedCountProblems(file, 2, 2), "")
  assert.match(pinnedCountProblems(file, 3, 2), /only shrinks/)
  assert.match(
    pinnedCountProblems(file, 1, 2),
    /Lower its pinned count from 2 to 1/
  )
  assert.match(pinnedCountProblems(file, 0, 2), /no longer has a small target/)
})

test("every interactive control in features is 44px on a phone", () => {
  const problems = featureFiles().flatMap((file) => {
    const found = smallTargets(
      readFileSync(path.join(root, file), "utf8"),
      file
    )
    const entry = pending.find((item) => item.file === file)
    if (entry) {
      const problem = pinnedCountProblems(file, found.length, entry.count)
      return problem ? [problem] : []
    }
    return found.map(
      (item) =>
        `${file}:${item.line} ${item.why}. A phone target is at least 44px; keep the desktop size behind md:.`
    )
  })
  assert.deepEqual(problems, [])
})
